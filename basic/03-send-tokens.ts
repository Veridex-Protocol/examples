/**
 * Example 03: Send Tokens
 * 
 * This example demonstrates how to send tokens from a Veridex vault
 * using passkey signatures for authorization.
 * 
 * Run: npx ts-node basic/03-send-tokens.ts
 */

import { createSDK } from '@veridex/sdk';
import { parseEther, parseUnits, formatEther, formatUnits, Wallet, JsonRpcProvider } from 'ethers';

// Configuration
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7'; // Example recipient
const TOKENS = {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

// For this example to work in Node.js, we need an EOA to pay for gas
// In a browser, this would be your injected provider (Metamask, etc.)
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat #0

async function main() {
    console.log('PAYMENTS Veridex Token Transfer Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================
    
    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    console.log('\nRPC SDK initialized for Base testnet');
    
    const vaultAddress = sdk.getVaultAddress();
    console.log(`LOCATION Sending from vault: ${vaultAddress}`);

    // =========================================================================
    // Step 2: Check Balance Before Transfer
    // =========================================================================
    
    console.log('\nBALANCE Checking balance before transfer...');
    
    try {
        const balanceResult = await sdk.getVaultNativeBalance();
        const balance = balanceResult.balance;
        console.log(`   Current balance: ${balanceResult.formatted} ETH`);

        if (balance < parseEther('0.001')) {
            console.log('\nWARN  Insufficient balance. Please fund your vault first.');
            console.log(`   Vault address: ${vaultAddress}`);
            return;
        }

        // =====================================================================
        // Step 3: Prepare Transfer
        // =====================================================================
        
        console.log('\nNOTE Preparing transfer...');
        
        const transferAmount = parseEther('0.001'); // 0.001 ETH
        
        // Prepare the transfer to get gas estimates and the challenge to sign
        const prepared = await sdk.prepareTransfer({
            token: 'native',
            recipient: RECIPIENT,
            amount: transferAmount,
            targetChain: 10004, // Base Sepolia
        });

        console.log(`\nNOTE Transfer Details:`);
        console.log(`   Token: ETH (native)`);
        console.log(`   Amount: ${formatEther(transferAmount)} ETH`);
        console.log(`   Recipient: ${RECIPIENT}`);
        console.log(`   Estimated Gas: ${prepared.estimatedGas}`);
        console.log(`   Total Cost: ${prepared.formattedCost}`);

        // =====================================================================
        // Step 4: Execute Transfer (with passkey signature)
        // =====================================================================
        
        console.log('\nSECURITY Signing with passkey...');
        console.log('   (This would trigger biometric prompt in browser)\n');

        // Execute the transfer
        // In a browser, this triggers the passkey signature prompt.
        // The signer is used to pay for the gas of the hub transaction.
        const result = await sdk.executeTransfer(prepared, signer);

        console.log('OK Transfer successful!');
        console.log(`\nNOTE Transaction Details:`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Sequence: ${result.sequence}`);

        // =====================================================================
        // Step 5: Check Balance After Transfer
        // =====================================================================
        
        console.log('\nBALANCE Balance after transfer:');
        const newBalance = await sdk.getVaultNativeBalance();
        console.log(`   New balance: ${newBalance.formatted} ETH`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\nERROR Transfer failed:', error.message);
            
            if (error.message.includes('insufficient')) {
                console.log('\n Fund your vault with testnet ETH and try again.');
            } else if (error.message.includes('cancelled')) {
                console.log('\n User cancelled the passkey signature.');
            }
        }
    }
}

// ============================================================================
// ERC20 Token Transfer Example
// ============================================================================

async function sendERC20() {
    console.log('\n' + '='.repeat(50));
    console.log(' ERC20 Token Transfer');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    const amount = parseUnits('10', 6); // 10 USDC (6 decimals)

    console.log('\nNOTE Sending 10 USDC...');

    try {
        const result = await sdk.transfer({
            token: TOKENS.USDC,
            recipient: RECIPIENT,
            amount: amount,
            targetChain: 10004,
        }, signer);

        console.log('OK USDC transfer successful!');
        console.log(`   TX Hash: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Batch Transfers Example
// ============================================================================

async function batchTransfer() {
    console.log('\n' + '='.repeat(50));
    console.log('PACKAGE Batch Transfer (Multiple Recipients)');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    const recipients = [
        { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7', amount: parseEther('0.001') },
        { address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', amount: parseEther('0.002') },
        { address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', amount: parseEther('0.001') },
    ];

    console.log('\nNOTE Batch transfer to 3 recipients...');
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

        console.log('OK Batch transfer successful!');
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Recipients: ${recipients.length}`);
        console.log(`   Total sent: ${formatEther(
            recipients.reduce((sum, r) => sum + r.amount, 0n)
        )} ETH`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Transaction Tracking Example
// ============================================================================

async function trackTransaction() {
    console.log('\n' + '='.repeat(50));
    console.log('LOCATION Transaction Tracking');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    console.log('\nIN PROGRESS Sending with real-time status updates...\n');

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
                        console.log('   WAIT Waiting for passkey signature...');
                        break;
                    case 'broadcasting':
                        console.log('   RPC Broadcasting transaction...');
                        break;
                    case 'pending':
                        console.log(`   WAIT Pending (TX: ${status.hash?.slice(0, 10)}...)`);
                        break;
                    case 'confirming':
                        console.log(`   IN PROGRESS Confirming (${status.confirmations}/${status.requiredConfirmations})`);
                        break;
                    case 'confirmed':
                        console.log(`   OK Confirmed in block ${status.blockNumber}`);
                        break;
                    case 'failed':
                        console.log(`   ERROR Failed: ${status.error}`);
                        break;
                }
            },
        });

        console.log(`\nDONE Transaction complete: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// Run examples
main()
    .then(() => sendERC20())
    .then(() => batchTransfer())
    .then(() => trackTransaction())
    .catch(console.error);
