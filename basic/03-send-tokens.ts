/**
 * Example 03: Send Tokens
 * 
 * This example demonstrates how to send tokens from a Veridex vault
 * using passkey signatures for authorization.
 * 
 * Run: npx ts-node basic/03-send-tokens.ts
 */

import { createSDK } from 'veridex-sdk';
import { parseEther, parseUnits, formatEther, formatUnits } from 'ethers';

// Configuration
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7'; // Example recipient
const TOKENS = {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

async function main() {
    console.log('💸 Veridex Token Transfer Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\n📡 SDK initialized for Base testnet');
    
    const vaultAddress = sdk.getVaultAddress();
    console.log(`📍 Sending from vault: ${vaultAddress}`);

    // =========================================================================
    // Step 2: Check Balance Before Transfer
    // =========================================================================
    
    console.log('\n💰 Checking balance before transfer...');
    
    try {
        const balance = await sdk.getBalance('native');
        console.log(`   Current balance: ${formatEther(balance)} ETH`);

        if (balance < parseEther('0.001')) {
            console.log('\n⚠️  Insufficient balance. Please fund your vault first.');
            console.log(`   Vault address: ${vaultAddress}`);
            return;
        }

        // =====================================================================
        // Step 3: Prepare Transfer
        // =====================================================================
        
        console.log('\n📝 Preparing transfer...');
        
        const transferAmount = parseEther('0.001'); // 0.001 ETH
        
        // Prepare the transfer to get gas estimates
        const prepared = await sdk.prepareTransfer({
            token: 'native',
            recipient: RECIPIENT,
            amount: transferAmount,
        });

        console.log(`\n📋 Transfer Details:`);
        console.log(`   Token: ETH (native)`);
        console.log(`   Amount: ${formatEther(transferAmount)} ETH`);
        console.log(`   Recipient: ${RECIPIENT}`);
        console.log(`   Estimated Gas: ${prepared.estimatedGas}`);
        console.log(`   Gas Price: ${formatUnits(prepared.gasPrice, 'gwei')} gwei`);

        // =====================================================================
        // Step 4: Execute Transfer (with passkey signature)
        // =====================================================================
        
        console.log('\n🔐 Signing with passkey...');
        console.log('   (This would trigger biometric prompt in browser)\n');

        // Execute the transfer
        // In a browser, this triggers the passkey signature prompt
        const result = await sdk.transfer({
            token: 'native',
            recipient: RECIPIENT,
            amount: transferAmount,
        });

        console.log('✅ Transfer successful!');
        console.log(`\n📋 Transaction Details:`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Block: ${result.blockNumber}`);
        console.log(`   Gas Used: ${result.gasUsed}`);

        // =====================================================================
        // Step 5: Check Balance After Transfer
        // =====================================================================
        
        console.log('\n💰 Balance after transfer:');
        const newBalance = await sdk.getBalance('native', { forceRefresh: true });
        console.log(`   New balance: ${formatEther(newBalance)} ETH`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Transfer failed:', error.message);
            
            if (error.message.includes('insufficient')) {
                console.log('\n💡 Fund your vault with testnet ETH and try again.');
            } else if (error.message.includes('cancelled')) {
                console.log('\n💡 User cancelled the passkey signature.');
            }
        }
    }
}

// ============================================================================
// ERC20 Token Transfer Example
// ============================================================================

async function sendERC20() {
    console.log('\n' + '='.repeat(50));
    console.log('🪙 ERC20 Token Transfer');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    
    const amount = parseUnits('10', 6); // 10 USDC (6 decimals)

    console.log('\n📋 Sending 10 USDC...');

    try {
        const result = await sdk.transfer({
            token: TOKENS.USDC,
            recipient: RECIPIENT,
            amount: amount,
        });

        console.log('✅ USDC transfer successful!');
        console.log(`   TX Hash: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Batch Transfers Example
// ============================================================================

async function batchTransfer() {
    console.log('\n' + '='.repeat(50));
    console.log('📦 Batch Transfer (Multiple Recipients)');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    const recipients = [
        { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7', amount: parseEther('0.001') },
        { address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', amount: parseEther('0.002') },
        { address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', amount: parseEther('0.001') },
    ];

    console.log('\n📋 Batch transfer to 3 recipients...');
    console.log('   (Single passkey signature for all transfers)\n');

    try {
        // Execute multiple transfers in a single vault transaction
        const result = await sdk.executeBatch([
            {
                type: 'transfer',
                token: 'native',
                recipient: recipients[0].address,
                amount: recipients[0].amount,
            },
            {
                type: 'transfer',
                token: 'native',
                recipient: recipients[1].address,
                amount: recipients[1].amount,
            },
            {
                type: 'transfer',
                token: 'native',
                recipient: recipients[2].address,
                amount: recipients[2].amount,
            },
        ]);

        console.log('✅ Batch transfer successful!');
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Recipients: ${recipients.length}`);
        console.log(`   Total sent: ${formatEther(
            recipients.reduce((sum, r) => sum + r.amount, 0n)
        )} ETH`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Transaction Tracking Example
// ============================================================================

async function trackTransaction() {
    console.log('\n' + '='.repeat(50));
    console.log('📍 Transaction Tracking');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    console.log('\n🔄 Sending with real-time status updates...\n');

    try {
        const result = await sdk.transfer({
            token: 'native',
            recipient: RECIPIENT,
            amount: parseEther('0.001'),
        }, {
            // Callback for status updates
            onProgress: (status) => {
                switch (status.state) {
                    case 'signing':
                        console.log('   ⏳ Waiting for passkey signature...');
                        break;
                    case 'broadcasting':
                        console.log('   📡 Broadcasting transaction...');
                        break;
                    case 'pending':
                        console.log(`   ⏳ Pending (TX: ${status.hash?.slice(0, 10)}...)`);
                        break;
                    case 'confirming':
                        console.log(`   🔄 Confirming (${status.confirmations}/${status.requiredConfirmations})`);
                        break;
                    case 'confirmed':
                        console.log(`   ✅ Confirmed in block ${status.blockNumber}`);
                        break;
                    case 'failed':
                        console.log(`   ❌ Failed: ${status.error}`);
                        break;
                }
            },
        });

        console.log(`\n🎉 Transaction complete: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// Run examples
main()
    .then(() => sendERC20())
    .then(() => batchTransfer())
    .then(() => trackTransaction())
    .catch(console.error);
