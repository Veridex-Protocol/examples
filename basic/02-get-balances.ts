/**
 * Example 02: Get Multi-Chain Balances
 * 
 * This example demonstrates how to query balances across multiple chains
 * for a Veridex vault.
 * 
 * Run: npm run basic:balances
 */

import { createSDK } from '@veridex/sdk';
import { formatEther, formatUnits } from 'ethers';

// Token addresses for reference (Base Sepolia)
const TOKENS = {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    WETH: '0x4200000000000000000000000000000000000006',
};

async function main() {
    console.log('💰 Veridex Multi-Chain Balance Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK and get vault address
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\n📡 SDK initialized for Base testnet');
    
    // You need to have a registered passkey first
    // For this example, we'll assume you've already registered
    // If not, run 01-create-wallet.ts first
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`\n📍 Vault address: ${vaultAddress}`);

        // =====================================================================
        // Step 2: Get Native Token Balance
        // =====================================================================
        
        console.log('\n✅ Fetching balances...\n');

        // Get native ETH balance on Base
        const nativeBalance = await sdk.getVaultNativeBalance();
        
        console.log('💵 Native Token Balance:');
        console.log(`   Base ETH: ${nativeBalance.formatted} ETH`);
        console.log(`   Raw: ${nativeBalance.balance.toString()} wei`);

        // =====================================================================
        // Step 3: Get ERC20 Token Balances
        // =====================================================================
        
        console.log('\n💎 ERC20 Token Balances:');
        
        const usdcBalance = await sdk.getVaultTokenBalance(TOKENS.USDC);
        console.log(`   USDC: ${usdcBalance.formatted} USDC`);
        console.log(`   Raw: ${usdcBalance.balance.toString()}`);

        // =====================================================================
        // Step 4: Get All Balances (Portfolio View)
        // =====================================================================
        
        console.log('\n📊 Complete Portfolio:');
        console.log('-'.repeat(50));

        const portfolio = await sdk.getVaultBalances(false); // false = exclude zero balances
        
        console.log(`\n   Chain: ${portfolio.chainName} (ID: ${portfolio.wormholeChainId})`);
        console.log(`   Total tokens: ${portfolio.tokens.length}`);
        
        for (const token of portfolio.tokens) {
            const symbol = token.token.symbol || 'UNKNOWN';
            const formatted = token.formatted || '0';
            console.log(`   • ${symbol}: ${formatted}`);
        }

        // =====================================================================
        // Step 5: Get Multi-Chain Portfolio
        // =====================================================================
        
        console.log('\n🌐 Multi-Chain Portfolio:');
        console.log('-'.repeat(50));

        // Wormhole chain IDs: Base Sepolia = 10004, Optimism Sepolia = 10005, Arbitrum Sepolia = 10003
        const multiChainBalances = await sdk.getMultiChainBalances([10004, 10005, 10003]);
        
        for (const chainBalance of multiChainBalances) {
            console.log(`\n   ${chainBalance.chainName} (ID: ${chainBalance.wormholeChainId}):`);
            
            const native = chainBalance.tokens.find(t => t.token.isNative);
            if (native) {
                console.log(`   └─ ${native.token.symbol}: ${native.formatted}`);
            }
            
            const erc20s = chainBalance.tokens.filter(t => !t.token.isNative);
            for (const token of erc20s) {
                console.log(`   └─ ${token.token.symbol}: ${token.formatted}`);
            }
        }

        // =====================================================================
        // Step 6: Check Vault Deployment Status
        // =====================================================================
        
        console.log('\n🏗️  Vault Deployment Status:');
        console.log('-'.repeat(50));

        const identity = await sdk.getUnifiedIdentity();
        
        for (const chainAddr of identity.addresses) {
            const status = chainAddr.deployed ? '✅ Deployed' : '⏳ Not Deployed';
            console.log(`   ${chainAddr.chainName}: ${status}`);
        }

        console.log('\n💡 Tip: Vaults are created automatically on first use,');
        console.log('   or you can pre-deploy with sdk.createVault()');

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Error fetching balances:', error.message);
            
            if (error.message.includes('No credential')) {
                console.log('\n💡 Tip: Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// Balance Caching Example
// ============================================================================

async function showBalanceCachingExample() {
    console.log('\n' + '='.repeat(50));
    console.log('⚡ Balance Caching Example');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    try {
        // The SDK includes a BalanceManager that caches balances
        // to reduce RPC calls and improve performance

        console.log('\n⏱️  First fetch (from RPC):');
        const start1 = Date.now();
        const balance1 = await sdk.getVaultNativeBalance();
        const time1 = Date.now() - start1;
        console.log(`   Time: ${time1}ms`);
        console.log(`   Balance: ${balance1.formatted} ETH`);

        console.log('\n⚡ Second fetch (from cache):');
        const start2 = Date.now();
        const balance2 = await sdk.getVaultNativeBalance();
        const time2 = Date.now() - start2;
        console.log(`   Time: ${time2}ms`);
        console.log(`   Balance: ${balance2.formatted} ETH`);
        console.log(`   Speedup: ${Math.round(time1 / time2)}x faster`);

        // Invalidate cache if needed
        console.log('\n🔄 Invalidate cache and refetch:');
        const vaultAddress = sdk.getVaultAddress();
        sdk.balance.invalidateCache(10004, vaultAddress); // Base Sepolia
        const start3 = Date.now();
        const balance3 = await sdk.getVaultNativeBalance();
        const time3 = Date.now() - start3;
        console.log(`   Time: ${time3}ms`);
        console.log(`   Balance: ${balance3.formatted} ETH`);
    } catch (error) {
        console.log('   ⚠️  Skipped (no credential registered)');
    }
}

// ============================================================================
// Cross-Chain Balance Comparison
// ============================================================================

async function showCrossChainBalances() {
    console.log('\n' + '='.repeat(50));
    console.log('🔗 Cross-Chain Balance Comparison');
    console.log('='.repeat(50));

    // Create SDKs for multiple chains
    const chains = ['base', 'optimism', 'arbitrum'] as const;
    
    console.log('\n💰 Vault balances across chains:\n');
    console.log('Chain          | ETH Balance      | Status');
    console.log('-'.repeat(50));

    for (const chain of chains) {
        try {
            const sdk = createSDK(chain);
            const balance = await sdk.getVaultNativeBalance();
            const formatted = balance.formatted.padEnd(16);
            console.log(`${chain.padEnd(14)} | ${formatted} | ✅`);
        } catch (error) {
            console.log(`${chain.padEnd(14)} | N/A              | ❌`);
        }
    }
}

// Run examples
main()
    .then(() => showBalanceCachingExample())
    .then(() => showCrossChainBalances())
    .catch(console.error);
