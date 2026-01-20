/**
 * Example 03: Send Tokens
 * 
 * This example demonstrates how to send tokens from a Veridex vault
 * using passkey signatures for authorization.
 * 
 * Run: npm run basic:send
 */

import { createSDK } from '@veridex/sdk';
import { parseEther, parseUnits, formatEther, Wallet, JsonRpcProvider } from 'ethers';

// Configuration
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7'; // Example recipient
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC

// For this example to work in Node.js, we need an EOA to pay for gas
// In a browser, this would be your injected provider (Metamask, etc.)
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat #0

async function main() {
    console.log('💸 Veridex Token Transfer Example\n');
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
        // Step 2: Check Balance Before Transfer
        // =====================================================================
        
        console.log('\n💰 Checking balance before transfer...');
        
        const balanceResult = await sdk.getVaultNativeBalance();
        const balance = balanceResult.balance;
        console.log(`   Current balance: ${balanceResult.formatted} ETH`);

        if (balance < parseEther('0.001')) {
            console.log('\n⚠️  Insufficient balance. Please fund your vault first.');
            console.log(`   Vault address: ${vaultAddress}`);
            console.log(`   Need at least: 0.001 ETH`);
            return;
        }

        // =====================================================================
        // Step 3: Prepare Transfer
        // =====================================================================
        
        console.log('\n📝 Preparing transfer...');
        
        const transferAmount = parseEther('0.0001'); // 0.0001 ETH
        const chainConfig = sdk.getChainConfig();
        
        // Prepare the transfer to get gas estimates
        const prepared = await sdk.prepareTransfer({
            token: 'native',
            recipient: RECIPIENT,
            amount: transferAmount,
            targetChain: chainConfig.wormholeChainId,
        });

        console.log(`\n📋 Transfer Details:`);
        console.log(`   Token: ETH (native)`);
        console.log(`   Amount: ${formatEther(transferAmount)} ETH`);
        console.log(`   Recipient: ${RECIPIENT}`);
        console.log(`   Estimated Gas: ${prepared.estimatedGas}`);
        console.log(`   Total Cost: ${prepared.formattedCost}`);

        // =====================================================================
        // Step 4: Get Human-Readable Summary
        // =====================================================================
        
        console.log('\n📊 Transaction Summary:');
        const summary = await sdk.getTransactionSummary(prepared);
        console.log(`   Action: ${summary.action.type}`);
        console.log(`   From: ${summary.action.from}`);
        console.log(`   To: ${summary.action.to}`);
        console.log(`   Amount: ${summary.action.amount}`);
        console.log(`   Risk Level: ${summary.riskLevel}`);

        // =====================================================================
        // Step 5: Execute Transfer (with passkey signature)
        // =====================================================================
        
        console.log('\n🔐 Signing with passkey...');
        console.log('   (This would trigger biometric prompt in browser)\n');

        // Execute the transfer
        // In a browser, this triggers the passkey signature prompt.
        // The signer is used to pay for the gas of the hub transaction.
        const result = await sdk.executeTransfer(prepared, signer);

        console.log('✅ Transfer successful!');
        console.log(`\n📋 Transaction Details:`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Sequence: ${result.sequence}`);
        console.log(`   Block: ${result.blockNumber || 'pending'}`);

        // =====================================================================
        // Step 6: Check Balance After Transfer
        // =====================================================================
        
        console.log('\n💰 Balance after transfer:');
        
        // Invalidate cache to get fresh balance
        sdk.balance.invalidateCache(chainConfig.wormholeChainId, vaultAddress);
        
        const newBalance = await sdk.getVaultNativeBalance();
        console.log(`   New balance: ${newBalance.formatted} ETH`);
        console.log(`   Difference: ${formatEther(balance - newBalance.balance)} ETH`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Transfer failed:', error.message);
            
            if (error.message.includes('insufficient')) {
                console.log('\n💡 Fund your vault with testnet ETH and try again.');
            } else if (error.message.includes('cancelled')) {
                console.log('\n💡 User cancelled the passkey signature.');
            } else if (error.message.includes('No credential')) {
                console.log('\n💡 Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// ERC20 Token Transfer Example
// ============================================================================

async function sendERC20() {
    console.log('\n' + '='.repeat(50));
    console.log('💎 ERC20 Token Transfer');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    const amount = parseUnits('1', 6); // 1 USDC (6 decimals)

    console.log('\n📝 Sending 1 USDC...');

    try {
        const chainConfig = sdk.getChainConfig();
        
        // Prepare transfer
        const prepared = await sdk.prepareTransfer({
            token: USDC_ADDRESS,
            recipient: RECIPIENT,
            amount: amount,
            targetChain: chainConfig.wormholeChainId,
        });

        console.log(`   Estimated Gas: ${prepared.estimatedGas}`);
        console.log(`   Total Cost: ${prepared.formattedCost}`);

        // Execute
        const result = await sdk.executeTransfer(prepared, signer);

        console.log('✅ USDC transfer successful!');
        console.log(`   TX Hash: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Transfer with Tracking Example
// ============================================================================

async function transferWithTracking() {
    console.log('\n' + '='.repeat(50));
    console.log('📍 Transfer with Real-Time Tracking');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);

    console.log('\n⏱️  Sending with real-time status updates...\n');

    try {
        const chainConfig = sdk.getChainConfig();
        
        const prepared = await sdk.prepareTransfer({
            token: 'native',
            recipient: RECIPIENT,
            amount: parseEther('0.0001'),
            targetChain: chainConfig.wormholeChainId,
        });

        // Execute with progress callback
        const result = await sdk.executeTransfer(prepared, signer);

        console.log(`\n✅ Transaction complete: ${result.transactionHash}`);
        
        // Wait for confirmation
        console.log('\n⏳ Waiting for confirmation...');
        const state = await sdk.waitForTransaction(result.transactionHash);
        console.log(`✅ Confirmed in block ${state.blockNumber}`);
        console.log(`   Confirmations: ${state.confirmations}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Spending Limits Check Example
// ============================================================================

async function checkSpendingLimits() {
    console.log('\n' + '='.repeat(50));
    console.log('🛡️  Spending Limits Check');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    try {
        const amount = parseEther('0.1');
        
        console.log('\n📊 Checking spending limits...');
        
        // Check if amount is within limits
        const limitCheck = await sdk.checkSpendingLimit(amount);
        
        console.log(`   Amount: ${formatEther(amount)} ETH`);
        console.log(`   Allowed: ${limitCheck.allowed ? '✅ Yes' : '❌ No'}`);
        
        if (!limitCheck.allowed) {
            console.log(`   Reason: ${limitCheck.violations.join(', ')}`);
            console.log('\n💡 Suggestions:');
            for (const suggestion of limitCheck.suggestions) {
                console.log(`   • ${suggestion.message}`);
            }
        }

        // Get current limits
        const limits = await sdk.getFormattedSpendingLimits();
        console.log('\n📋 Current Limits:');
        console.log(`   Daily Limit: ${limits.dailyLimit.formatted}`);
        console.log(`   Daily Spent: ${limits.dailySpent.formatted}`);
        console.log(`   Daily Remaining: ${limits.dailyRemaining.formatted}`);
        console.log(`   Transaction Limit: ${limits.transactionLimit.formatted}`);
    } catch (error) {
        console.log('   ⚠️  Skipped (no credential registered)');
    }
}

// Run examples
main()
    .then(() => sendERC20())
    .then(() => transferWithTracking())
    .then(() => checkSpendingLimits())
    .catch(console.error);
