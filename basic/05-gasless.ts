/**
 * Example 05: Gasless Transactions
 * 
 * This example demonstrates how to execute transactions without holding
 * any gas tokens. The relayer pays for gas and optionally charges a fee.
 * 
 * Run: npx ts-node basic/05-gasless.ts
 */

import { createSDK } from 'veridex-sdk';
import { parseEther, parseUnits, formatEther, formatUnits } from 'ethers';

// Relayer configuration
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3001';
const RELAYER_API_KEY = process.env.RELAYER_API_KEY;

async function main() {
    console.log(' Veridex Gasless Transactions Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK with Relayer
    // =========================================================================
    
    console.log('\nRPC Initializing SDK with relayer...');
    
    // The key is configuring relayerUrl
    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
        relayerApiKey: RELAYER_API_KEY,
    });

    console.log(`   Relayer: ${RELAYER_URL}`);
    console.log('OK SDK initialized with gasless support');

    const vaultAddress = sdk.getVaultAddress();
    console.log(`\nLOCATION Your vault: ${vaultAddress}`);

    // =========================================================================
    // Step 2: Check Relayer Status
    // =========================================================================
    
    console.log('\nVERIFY Checking relayer status...');
    
    try {
        const relayerInfo = await sdk.relayer.getInfo();
        
        console.log(`\n Relayer Information:`);
        console.log(`   Status: ${relayerInfo.status}`);
        console.log(`   Supported Chains: ${relayerInfo.supportedChains.join(', ')}`);
        console.log(`   Fee Model: ${relayerInfo.feeModel}`);
        console.log(`   Version: ${relayerInfo.version}`);

        // =====================================================================
        // Step 3: Get Fee Quote
        // =====================================================================
        
        console.log('\n Getting fee quote...');
        
        const feeQuote = await sdk.relayer.quoteFee({
            action: 'transfer',
            token: 'native',
            amount: parseEther('0.01'),
            targetChain: 10004, // Base
        });

        console.log(`\nNOTE Fee Quote:`);
        console.log(`   Relayer Fee: ${formatEther(feeQuote.relayerFee)} ETH`);
        console.log(`   Gas Estimate: ${feeQuote.gasEstimate}`);
        console.log(`   Total: ${formatEther(feeQuote.total)} ETH`);
        console.log(`   Fee paid from: ${feeQuote.feeDeductedFrom}`);

        // =====================================================================
        // Step 4: Execute Gasless Transfer
        // =====================================================================
        
        console.log('\nSTART Executing gasless transfer...');
        console.log('   (You sign with passkey, relayer pays gas)\n');

        const result = await sdk.transferViaRelayer({
            token: 'native',
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7',
            amount: parseEther('0.001'),
        }, {
            onProgress: (status) => {
                switch (status.stage) {
                    case 'preparing':
                        console.log('   NOTE Preparing transaction...');
                        break;
                    case 'signing':
                        console.log('   SECURITY Signing with passkey...');
                        break;
                    case 'submitting':
                        console.log('   SEND Submitting to relayer...');
                        break;
                    case 'relaying':
                        console.log('    Relayer broadcasting...');
                        break;
                    case 'confirming':
                        console.log('   WAIT Waiting for confirmation...');
                        break;
                    case 'complete':
                        console.log('   OK Transaction confirmed!');
                        break;
                }
            },
        });

        console.log('\nDONE Gasless transfer successful!');
        console.log(`\nNOTE Transaction Details:`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Block: ${result.blockNumber}`);
        console.log(`   Fee Paid: ${formatEther(result.feePaid)} ETH`);
        console.log(`   Fee Paid By: Relayer REWARD`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\nERROR Error:', error.message);
            
            if (error.message.includes('connection')) {
                console.log('\n Make sure the relayer is running:');
                console.log('   cd packages/relayer && npm start');
            }
        }
    }
}

// ============================================================================
// Gasless Bridge Example
// ============================================================================

async function gaslessBridge() {
    console.log('\n' + '='.repeat(50));
    console.log('BRIDGE Gasless Cross-Chain Bridge');
    console.log('='.repeat(50));

    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
    });

    console.log('\nNOTE Bridging 0.005 ETH to Optimism (gasless)...\n');

    try {
        const result = await sdk.bridgeViaRelayer({
            targetChain: 10005, // Optimism Sepolia
            token: 'native',
            amount: parseEther('0.005'),
        }, {
            onProgress: (status) => {
                console.log(`   ${status.stage}: ${status.message || '...'}`);
            },
        });

        console.log('\nOK Gasless bridge complete!');
        console.log(`   Source TX: ${result.sourceTxHash}`);
        console.log(`   Target TX: ${result.targetTxHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Gasless Contract Execution
// ============================================================================

async function gaslessContractCall() {
    console.log('\n' + '='.repeat(50));
    console.log(' Gasless Contract Execution');
    console.log('='.repeat(50));

    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
    });

    // Example: Execute a function on any contract
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const functionData = '0x...'; // Encoded function call

    console.log('\nNOTE Executing contract call (gasless)...');

    try {
        const result = await sdk.executeViaRelayer({
            target: contractAddress,
            data: functionData,
            value: 0n, // Optional ETH value
        });

        console.log('OK Contract execution complete!');
        console.log(`   TX Hash: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Sponsored Vault Creation
// ============================================================================

async function sponsoredVaultCreation() {
    console.log('\n' + '='.repeat(50));
    console.log(' Sponsored Vault Creation');
    console.log('='.repeat(50));

    console.log('\nNOTE Creating vault with sponsored gas...');
    console.log('   (User pays nothing, sponsor pays gas)\n');

    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
    });

    try {
        // First, register passkey (user does this)
        await sdk.passkey.register('newuser@example.com', 'New User');

        // Create vault with sponsored gas
        const result = await sdk.createVaultSponsored({
            onProgress: (status) => {
                switch (status.stage) {
                    case 'computing':
                        console.log('   NOTE Computing vault address...');
                        break;
                    case 'checking':
                        console.log('   VERIFY Checking if vault exists...');
                        break;
                    case 'creating':
                        console.log('     Creating vault (sponsored)...');
                        break;
                    case 'confirming':
                        console.log('   WAIT Confirming...');
                        break;
                    case 'complete':
                        console.log('   OK Vault created!');
                        break;
                }
            },
        });

        console.log('\nDONE Vault created with sponsored gas!');
        console.log(`   Vault Address: ${result.vaultAddress}`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Gas Cost: ${formatEther(result.gasCost)} ETH (paid by sponsor)`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Fee Structure Explanation
// ============================================================================

function explainFeeStructure() {
    console.log('\n' + '='.repeat(50));
    console.log('BALANCE Gasless Fee Structure');
    console.log('='.repeat(50));

    console.log(`
NOTE How Gasless Transactions Work:

1. USER SIGNS
   User signs the action with their passkey.
   No gas token needed in their wallet!

2. RELAYER RECEIVES
   Signed action is sent to the relayer service.
   Relayer validates the signature.

3. RELAYER PAYS GAS
   Relayer submits transaction and pays gas.
   Transaction executes on-chain.

4. FEE MODELS

   Model A: Free (Sponsored)
   ├─ Relayer pays all fees
   └─ Used for user onboarding, promotions

   Model B: Fee Deducted from Transfer
   ├─ Small fee deducted from transfer amount
   ├─ User receives: amount - fee
   └─ Common for regular transfers

   Model C: Separate Fee Token
   ├─ Fee paid in stablecoins (USDC)
   ├─ Transfer amount unchanged
   └─ Used for large transfers

   Model D: Subscription
   ├─ Monthly flat fee for unlimited transactions
   ├─ Best for high-frequency users
   └─ Typically for B2B integrations

5. SECURITY

   OK User always signs the exact action
   OK Relayer cannot modify the transaction
   OK Passkey signature is verified on-chain
   OK Replay protection via nonces
    `);
}

// Run examples
main()
    .then(() => gaslessBridge())
    .then(() => sponsoredVaultCreation())
    .then(() => explainFeeStructure())
    .catch(console.error);
