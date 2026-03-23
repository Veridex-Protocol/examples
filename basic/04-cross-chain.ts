/**
 * Example 04: Cross-Chain Bridging
 * 
 * This example demonstrates how to bridge tokens across chains using
 * Wormhole's cross-chain messaging.
 * 
 * Run: npm run basic:crosschain
 */

import { createSDK, getChainConfig } from '@veridex/sdk';
import { parseEther, parseUnits, formatEther, Wallet, JsonRpcProvider } from 'ethers';

// Configuration
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Use chain presets instead of hardcoded Wormhole IDs
const BASE = getChainConfig('base', 'testnet');
const OPTIMISM = getChainConfig('optimism', 'testnet');
const ARBITRUM = getChainConfig('arbitrum', 'testnet');

async function main() {
    console.log('🌉 Veridex Cross-Chain Bridge Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================
    
    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    console.log('\n📡 SDK initialized for Base testnet');
    console.log(`💳 Signer address: ${signer.address}`);
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`📍 Vault address: ${vaultAddress}`);

        // =====================================================================
        // Step 2: Check Balance Before Bridge
        // =====================================================================
        
        console.log('\n💰 Checking balance before bridge...');
        
        const balance = await sdk.getVaultNativeBalance();
        console.log(`   Base balance: ${balance.formatted} ETH`);

        if (balance.balance < parseEther('0.001')) {
            console.log('\n⚠️  Insufficient balance. Please fund your vault first.');
            console.log(`   Vault address: ${vaultAddress}`);
            return;
        }

        // =====================================================================
        // Step 3: Prepare Bridge Transaction
        // =====================================================================
        
        console.log('\n📝 Preparing bridge transaction...');
        
        const bridgeAmount = parseEther('0.0001'); // 0.0001 ETH
        
        // Prepare the bridge to get fee estimates
        const prepared = await sdk.prepareBridge({
            sourceChain: BASE.wormholeChainId,
            token: 'native',
            amount: bridgeAmount,
            destinationChain: OPTIMISM.wormholeChainId,
            recipient: vaultAddress, // Bridge to your vault on Optimism
        });

        console.log(`\n📋 Bridge Details:`);
        console.log(`   From: Base Sepolia`);
        console.log(`   To: Optimism Sepolia`);
        console.log(`   Token: ETH (native)`);
        console.log(`   Amount: ${formatEther(bridgeAmount)} ETH`);
        console.log(`   Recipient: ${vaultAddress}`);
        console.log(`   Estimated Gas: ${prepared.fees.sourceGas}`);
        console.log(`   Wormhole Fee: ${formatEther(prepared.fees.messageFee)} ETH`);
        console.log(`   Total Cost: ${prepared.fees.formattedTotal}`);

        // =====================================================================
        // Step 4: Get Bridge Fees Breakdown
        // =====================================================================
        
        console.log('\n💵 Fee Breakdown:');
        const fees = await sdk.getBridgeFees({
            sourceChain: BASE.wormholeChainId,
            token: 'native',
            amount: bridgeAmount,
            destinationChain: OPTIMISM.wormholeChainId,
            recipient: vaultAddress,
        });
        
        console.log(`   Source Gas: ${formatEther(fees.sourceGas)} ETH`);
        console.log(`   Wormhole Fee: ${formatEther(fees.messageFee)} ETH`);
        console.log(`   Relayer Fee: ${formatEther(fees.relayerFee)} ETH`);
        console.log(`   Total: ${formatEther(fees.totalCost)} ETH`);

        // =====================================================================
        // Step 5: Execute Bridge (with passkey signature)
        // =====================================================================
        
        console.log('\n🔐 Signing with passkey...');
        console.log('   (This would trigger biometric prompt in browser)\n');

        // Execute the bridge
        const result = await sdk.executeBridge(prepared, signer);

        console.log('✅ Bridge transaction submitted!');
        console.log(`\n📋 Transaction Details:`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Sequence: ${result.sequence}`);
        console.log(`   VAA: ${result.vaa ? 'Available' : 'Pending'}`);

        // =====================================================================
        // Step 6: Track Cross-Chain Progress
        // =====================================================================
        
        console.log('\n⏳ Tracking cross-chain progress...');
        console.log('   (This may take 1-2 minutes for VAA finalization)\n');

        // In a real application, you would poll for VAA availability
        console.log('   1. ✅ Transaction confirmed on Base');
        console.log('   2. ⏳ Waiting for Wormhole Guardians (13/19 signatures)...');
        console.log('   3. ⏳ VAA will be available in ~15 seconds');
        console.log('   4. ⏳ Relaying to Optimism...');
        console.log('   5. ⏳ Finalizing on destination chain...');

        console.log('\n💡 Tip: Use sdk.fetchVAAForTransaction() to get the VAA');
        console.log('   Then relay it to the destination chain manually or via relayer');

        // =====================================================================
        // Step 7: Check Balances After Bridge
        // =====================================================================
        
        console.log('\n💰 Expected balances after bridge:');
        console.log(`   Base: ${formatEther(balance.balance - bridgeAmount - fees.totalCost)} ETH (decreased)`);
        console.log(`   Optimism: +${formatEther(bridgeAmount)} ETH (increased)`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Bridge failed:', error.message);
            
            if (error.message.includes('insufficient')) {
                console.log('\n💡 Fund your vault with testnet ETH and try again.');
            } else if (error.message.includes('No credential')) {
                console.log('\n💡 Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// Bridge with Relayer (Automatic VAA Relay)
// ============================================================================

async function bridgeViaRelayer() {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Bridge via Relayer (Automatic)');
    console.log('='.repeat(50));

    // Create SDK with relayer configured
    const sdk = createSDK('base', {
        relayerUrl: 'https://relayer.veridex.network',
    });

    console.log('\n📝 Bridging with automatic VAA relay...');

    try {
        const vaultAddress = sdk.getVaultAddress();
        
        // Bridge via relayer - handles VAA fetching and relaying automatically
        const result = await sdk.bridgeViaRelayer(
            {
                sourceChain: CHAINS.BASE_SEPOLIA,
                token: 'native',
                amount: parseEther('0.0001'),
                destinationChain: CHAINS.OPTIMISM_SEPOLIA,
                recipient: vaultAddress,
            },
            (progress) => {
                console.log(`   Status: ${progress.status}`);
                console.log(`   Message: ${progress.message}`);
            }
        );

        console.log('\n✅ Bridge complete!');
        console.log(`   Source TX: ${result.transactionHash}`);
        console.log(`   Destination TX: ${result.destinationTxHash ?? 'pending'}`);
        console.log(`   Total Time: ${result.duration}ms`);
    } catch (error) {
        console.log('   ⚠️  Relayer not available or credential not registered');
    }
}

// ============================================================================
// ERC20 Bridge Example
// ============================================================================

async function bridgeERC20() {
    console.log('\n' + '='.repeat(50));
    console.log('💎 Bridge ERC20 Tokens');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);

    console.log('\n📝 Bridging 10 USDC from Base to Optimism...');

    try {
        const vaultAddress = sdk.getVaultAddress();
        const amount = parseUnits('10', 6); // 10 USDC (6 decimals)
        
        const prepared = await sdk.prepareBridge({
            sourceChain: CHAINS.BASE_SEPOLIA,
            token: USDC_ADDRESS,
            amount: amount,
            destinationChain: CHAINS.OPTIMISM_SEPOLIA,
            recipient: vaultAddress,
        });

        console.log(`   Amount: 10 USDC`);
        console.log(`   Estimated Gas: ${prepared.fees.sourceGas}`);
        console.log(`   Wormhole Fee: ${formatEther(prepared.fees.messageFee)} ETH`);

        const result = await sdk.executeBridge(prepared, signer);

        console.log('✅ USDC bridge submitted!');
        console.log(`   TX Hash: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Multi-Chain Balance Check
// ============================================================================

async function checkMultiChainBalances() {
    console.log('\n' + '='.repeat(50));
    console.log('🌐 Multi-Chain Balance Check');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    try {
        console.log('\n💰 Checking balances across chains...\n');
        
        const balances = await sdk.getMultiChainBalances([
            CHAINS.BASE_SEPOLIA,
            CHAINS.OPTIMISM_SEPOLIA,
            CHAINS.ARBITRUM_SEPOLIA,
        ]);

        for (const chainBalance of balances) {
            const native = chainBalance.tokens.find(t => t.token.isNative);
            console.log(`   ${chainBalance.chainName}: ${native?.formatted || '0 ETH'}`);
        }
    } catch (error) {
        console.log('   ⚠️  Skipped (no credential registered)');
    }
}

// Run examples
main()
    .then(() => bridgeViaRelayer())
    .then(() => bridgeERC20())
    .then(() => checkMultiChainBalances())
    .catch(console.error);
