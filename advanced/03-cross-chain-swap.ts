/**
 * Cross-Chain Atomic Swap Example
 * 
 * This example demonstrates how to perform atomic cross-chain swaps
 * using Veridex's Wormhole integration.
 * 
 * Use cases:
 * - Trustless P2P trading across chains
 * - DEX aggregation with cross-chain routing
 * - Portfolio rebalancing across networks
 */

import { createSDK } from 'veridex-sdk';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

interface SwapOrder {
    id: string;
    maker: string;
    makerChain: string;
    makerToken: string;
    makerAmount: bigint;
    taker: string | null;
    takerChain: string;
    takerToken: string;
    takerAmount: bigint;
    expiresAt: Date;
    status: 'open' | 'matched' | 'executing' | 'completed' | 'cancelled' | 'expired';
    secretHash: string;
    secret?: string;
}

interface SwapLeg {
    chain: string;
    token: string;
    amount: bigint;
    vaultAddress: string;
}

class CrossChainSwapManager {
    private sdks: Map<string, ReturnType<typeof createSDK>> = new Map();
    private orders: Map<string, SwapOrder> = new Map();
    private supportedChains = ['base-sepolia', 'optimism-sepolia', 'arbitrum-sepolia'];

    constructor() {
        // Initialize SDKs for all supported chains
        for (const chain of this.supportedChains) {
            this.sdks.set(chain, createSDK(chain));
        }
    }

    /**
     * Create a swap order (maker side)
     */
    async createOrder(
        makerVault: string,
        makerChain: string,
        makerToken: string,
        makerAmount: bigint,
        takerChain: string,
        takerToken: string,
        takerAmount: bigint,
        expiryHours: number = 24
    ): Promise<string> {
        // Generate secret and hash for HTLC
        const secret = ethers.hexlify(ethers.randomBytes(32));
        const secretHash = ethers.keccak256(secret);

        const orderId = ethers.id(
            `swap:${makerVault}:${Date.now()}`
        ).slice(0, 18);

        const order: SwapOrder = {
            id: orderId,
            maker: makerVault,
            makerChain,
            makerToken,
            makerAmount,
            taker: null,
            takerChain,
            takerToken,
            takerAmount,
            expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
            status: 'open',
            secretHash,
            secret, // Keep secret private until swap completes
        };

        this.orders.set(orderId, order);

        console.log(`📝 Swap Order Created: ${orderId}`);
        console.log(`   Offering: ${ethers.formatEther(makerAmount)} ${this.getTokenSymbol(makerToken)} on ${makerChain}`);
        console.log(`   Wanting: ${ethers.formatEther(takerAmount)} ${this.getTokenSymbol(takerToken)} on ${takerChain}`);
        console.log(`   Expires: ${order.expiresAt.toISOString()}`);
        console.log(`   Secret Hash: ${secretHash.slice(0, 20)}...`);

        return orderId;
    }

    /**
     * Match an order (taker side)
     */
    async matchOrder(orderId: string, takerVault: string): Promise<boolean> {
        const order = this.orders.get(orderId);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'open') throw new Error(`Order is ${order.status}`);
        if (new Date() > order.expiresAt) {
            order.status = 'expired';
            throw new Error('Order has expired');
        }

        order.taker = takerVault;
        order.status = 'matched';

        console.log(`🤝 Order matched!`);
        console.log(`   Taker: ${takerVault}`);
        console.log(`   Ready for execution`);

        return true;
    }

    /**
     * Execute the swap (atomic HTLC process)
     */
    async executeSwap(orderId: string): Promise<{
        makerTxHash: string;
        takerTxHash: string;
    }> {
        const order = this.orders.get(orderId);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'matched') throw new Error(`Order must be matched, is ${order.status}`);
        if (!order.taker) throw new Error('No taker for this order');

        order.status = 'executing';

        console.log(`\n🔄 Executing Cross-Chain Swap: ${orderId}`);
        console.log('='.repeat(50));

        // Step 1: Taker locks funds first (they don't know the secret yet)
        console.log('\n📍 Step 1: Taker locks funds on destination chain');
        const takerLockHash = await this.lockFunds({
            chain: order.takerChain,
            token: order.takerToken,
            amount: order.takerAmount,
            vaultAddress: order.taker,
        }, order.secretHash, order.maker, 3600); // 1 hour timeout

        console.log(`   ✅ Taker locked ${ethers.formatEther(order.takerAmount)} ${this.getTokenSymbol(order.takerToken)}`);
        console.log(`   TX: ${takerLockHash}`);

        // Step 2: Maker locks funds (seeing taker has committed)
        console.log('\n📍 Step 2: Maker locks funds on source chain');
        const makerLockHash = await this.lockFunds({
            chain: order.makerChain,
            token: order.makerToken,
            amount: order.makerAmount,
            vaultAddress: order.maker,
        }, order.secretHash, order.taker, 1800); // 30 min timeout (shorter!)

        console.log(`   ✅ Maker locked ${ethers.formatEther(order.makerAmount)} ${this.getTokenSymbol(order.makerToken)}`);
        console.log(`   TX: ${makerLockHash}`);

        // Step 3: Maker claims taker's funds (revealing secret)
        console.log('\n📍 Step 3: Maker claims (reveals secret)');
        const makerClaimHash = await this.claimFunds({
            chain: order.takerChain,
            token: order.takerToken,
            amount: order.takerAmount,
            vaultAddress: order.maker,
        }, order.secret!);

        console.log(`   ✅ Maker claimed ${ethers.formatEther(order.takerAmount)} ${this.getTokenSymbol(order.takerToken)}`);
        console.log(`   TX: ${makerClaimHash}`);
        console.log(`   🔑 Secret revealed on-chain`);

        // Step 4: Taker sees secret on-chain, claims maker's funds
        console.log('\n📍 Step 4: Taker claims (using revealed secret)');
        const takerClaimHash = await this.claimFunds({
            chain: order.makerChain,
            token: order.makerToken,
            amount: order.makerAmount,
            vaultAddress: order.taker,
        }, order.secret!);

        console.log(`   ✅ Taker claimed ${ethers.formatEther(order.makerAmount)} ${this.getTokenSymbol(order.makerToken)}`);
        console.log(`   TX: ${takerClaimHash}`);

        order.status = 'completed';

        return {
            makerTxHash: makerClaimHash,
            takerTxHash: takerClaimHash,
        };
    }

    /**
     * Cancel an open order
     */
    async cancelOrder(orderId: string): Promise<void> {
        const order = this.orders.get(orderId);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'open') throw new Error('Can only cancel open orders');

        order.status = 'cancelled';
        console.log(`❌ Order ${orderId} cancelled`);
    }

    /**
     * Get open orders for a token pair
     */
    getOpenOrders(
        makerChain?: string,
        takerChain?: string
    ): SwapOrder[] {
        return Array.from(this.orders.values()).filter(order => {
            if (order.status !== 'open') return false;
            if (new Date() > order.expiresAt) return false;
            if (makerChain && order.makerChain !== makerChain) return false;
            if (takerChain && order.takerChain !== takerChain) return false;
            return true;
        });
    }

    // =========================================================================
    // Private helper methods
    // =========================================================================

    private async lockFunds(
        leg: SwapLeg,
        secretHash: string,
        recipient: string,
        timeoutSeconds: number
    ): Promise<string> {
        // In production, this calls the HTLC contract on the respective chain
        // The funds are locked until either:
        // 1. The secret is revealed (recipient can claim)
        // 2. Timeout expires (sender can refund)
        
        const sdk = this.sdks.get(leg.chain);
        if (!sdk) throw new Error(`SDK not found for ${leg.chain}`);

        // Simulated transaction
        return ethers.id(`lock:${leg.chain}:${secretHash}:${Date.now()}`);
    }

    private async claimFunds(
        leg: SwapLeg,
        secret: string
    ): Promise<string> {
        // In production, this calls the HTLC contract to claim funds
        // Requires knowing the secret that hashes to secretHash
        
        const sdk = this.sdks.get(leg.chain);
        if (!sdk) throw new Error(`SDK not found for ${leg.chain}`);

        // Simulated transaction
        return ethers.id(`claim:${leg.chain}:${secret}:${Date.now()}`);
    }

    private getTokenSymbol(address: string): string {
        if (address === ethers.ZeroAddress) return 'ETH';
        // In production, look up token symbol
        return address.slice(0, 8);
    }
}

async function main() {
    console.log('⚡ Veridex Cross-Chain Atomic Swap Example\n');
    console.log('='.repeat(50));

    const swapManager = new CrossChainSwapManager();

    // =========================================================================
    // Scenario: Alice (Base) wants to swap ETH for OP tokens on Optimism
    // Bob (Optimism) has OP tokens and wants ETH on Base
    // =========================================================================

    const aliceVault = '0x' + 'aaa'.repeat(13) + 'a';
    const bobVault = '0x' + 'bbb'.repeat(13) + 'b';

    // Step 1: Alice creates a swap order
    console.log('\n📋 Step 1: Alice Creates Swap Order\n');
    
    const orderId = await swapManager.createOrder(
        aliceVault,
        'base-sepolia',
        ethers.ZeroAddress, // ETH
        ethers.parseEther('0.5'),
        'optimism-sepolia',
        '0x4200000000000000000000000000000000000042', // OP token
        ethers.parseEther('100'), // 100 OP
        24 // 24 hour expiry
    );

    // Step 2: Bob sees the order and matches it
    console.log('\n📋 Step 2: Bob Matches the Order\n');
    
    await swapManager.matchOrder(orderId, bobVault);

    // Step 3: Execute the atomic swap
    console.log('\n📋 Step 3: Execute Atomic Swap');
    
    const result = await swapManager.executeSwap(orderId);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Swap Complete!');
    console.log('='.repeat(50));
    console.log(`\nAlice received: 100 OP on Optimism`);
    console.log(`Bob received: 0.5 ETH on Base`);
    console.log(`\nTransactions:`);
    console.log(`   Alice claim: ${result.makerTxHash.slice(0, 20)}...`);
    console.log(`   Bob claim: ${result.takerTxHash.slice(0, 20)}...`);

    // =========================================================================
    // Integration Guide
    // =========================================================================

    console.log('\n' + '='.repeat(50));
    console.log('📚 Integration Guide');
    console.log('='.repeat(50));

    console.log(`
    // Using Veridex SDK for cross-chain swaps:
    
    const sdk = createSDK('base');
    
    // 1. Get a quote for cross-chain swap
    const quote = await sdk.getCrossChainQuote({
      fromChain: 'base',
      toChain: 'optimism',
      fromToken: 'ETH',
      toToken: 'OP',
      amount: parseEther('0.5'),
    });
    
    console.log('Rate:', quote.rate);
    console.log('Fee:', quote.fee);
    console.log('Estimated time:', quote.estimatedTime);
    
    // 2. Execute the swap (handles HTLC automatically)
    const swap = await sdk.executeSwap(quote.quoteId);
    
    // 3. Monitor progress
    swap.on('locked', (chain) => console.log(\`Funds locked on \${chain}\`));
    swap.on('claimed', (chain) => console.log(\`Funds claimed on \${chain}\`));
    swap.on('completed', () => console.log('Swap complete!'));
    
    // 4. For P2P order book style:
    const orderId = await sdk.createSwapOrder({
      offer: { chain: 'base', token: 'ETH', amount: parseEther('1') },
      want: { chain: 'optimism', token: 'USDC', amount: parseUnits('2000', 6) },
      expiry: 24 * 60 * 60, // 24 hours
    });
    
    // Others can match your order
    await sdk.matchSwapOrder(orderId);
    
    // Atomic execution via HTLC
    const result = await sdk.executeSwapOrder(orderId);
    `);

    console.log('\n✅ Cross-chain swap example complete!');
}

main().catch(console.error);
