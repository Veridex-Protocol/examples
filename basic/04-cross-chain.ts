/**
 * Example 04: Cross-Chain Transfers
 * 
 * This example demonstrates how to bridge tokens between chains using
 * Veridex and Wormhole for secure cross-chain messaging.
 * 
 * Run: npx ts-node basic/04-cross-chain.ts
 */

import { createSDK, CHAIN_PRESETS } from 'veridex-sdk';
import { parseEther, parseUnits, formatEther, formatUnits } from 'ethers';

// Wormhole Chain IDs
const CHAIN_IDS = {
    BASE_SEPOLIA: 10004,
    OPTIMISM_SEPOLIA: 10005,
    ARBITRUM_SEPOLIA: 10003,
    SOLANA_DEVNET: 1,
};

async function main() {
    console.log('BRIDGE Veridex Cross-Chain Transfer Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\nRPC SDK initialized for Base testnet (Hub chain)');
    
    const vaultAddress = sdk.getVaultAddress();
    console.log(`LOCATION Your vault: ${vaultAddress}`);

    // =========================================================================
    // Step 2: Check Source Chain Balance
    // =========================================================================
    
    console.log('\nBALANCE Checking Base balance...');
    
    try {
        const balance = await sdk.getBalance('native');
        console.log(`   Balance: ${formatEther(balance)} ETH`);

        if (balance < parseEther('0.01')) {
            console.log('\nWARN  Minimum 0.01 ETH needed for cross-chain transfer.');
            console.log('   Bridge fees + gas required.');
            return;
        }

        // =====================================================================
        // Step 3: Get Bridge Quote
        // =====================================================================
        
        console.log('\n Getting bridge quote...');
        
        const bridgeAmount = parseEther('0.005');
        
        const quote = await sdk.quoteBridge({
            targetChain: CHAIN_IDS.OPTIMISM_SEPOLIA,
            token: 'native',
            amount: bridgeAmount,
        });

        console.log(`\nNOTE Bridge Quote:`);
        console.log(`   Source: Base Sepolia`);
        console.log(`   Target: Optimism Sepolia`);
        console.log(`   Amount: ${formatEther(bridgeAmount)} ETH`);
        console.log(`   Bridge Fee: ${formatEther(quote.bridgeFee)} ETH`);
        console.log(`   Relayer Fee: ${formatEther(quote.relayerFee)} ETH`);
        console.log(`   Total Cost: ${formatEther(quote.totalCost)} ETH`);
        console.log(`   Estimated Time: ${quote.estimatedTime} seconds`);

        // =====================================================================
        // Step 4: Execute Bridge Transfer
        // =====================================================================
        
        console.log('\nSECURITY Initiating cross-chain transfer...');
        console.log('   (This triggers passkey signature)\n');

        const result = await sdk.bridge({
            targetChain: CHAIN_IDS.OPTIMISM_SEPOLIA,
            token: 'native',
            amount: bridgeAmount,
            // Optional: specify recipient (defaults to same vault address)
            // recipient: '0x...',
        }, {
            onProgress: (progress) => {
                switch (progress.stage) {
                    case 'signing':
                        console.log('   SECURITY Signing with passkey...');
                        break;
                    case 'dispatching':
                        console.log('   RPC Dispatching to Hub...');
                        break;
                    case 'wormhole':
                        console.log('   NETWORK Waiting for Wormhole attestation...');
                        break;
                    case 'guardians':
                        console.log(`    Guardian signatures: ${progress.signatures}/13`);
                        break;
                    case 'relaying':
                        console.log('    Relaying to target chain...');
                        break;
                    case 'confirming':
                        console.log('   WAIT Confirming on target chain...');
                        break;
                    case 'complete':
                        console.log('   OK Bridge complete!');
                        break;
                }
            },
        });

        console.log('\nDONE Cross-chain transfer successful!');
        console.log(`\nNOTE Transaction Details:`);
        console.log(`   Source TX: ${result.sourceTxHash}`);
        console.log(`   Target TX: ${result.targetTxHash}`);
        console.log(`   VAA Sequence: ${result.vaaSequence}`);
        console.log(`   Amount Received: ${formatEther(result.amountReceived)} ETH`);

        // =====================================================================
        // Step 5: Verify on Target Chain
        // =====================================================================
        
        console.log('\nVERIFY Verifying on Optimism...');
        
        const optimismSdk = createSDK('optimism');
        const newBalance = await optimismSdk.getBalance('native');
        console.log(`   Optimism Balance: ${formatEther(newBalance)} ETH`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\nERROR Bridge failed:', error.message);
            
            if (error.message.includes('timeout')) {
                console.log('\n Wormhole attestation may take up to 15 minutes.');
                console.log('   Check back later or track via Wormhole Explorer.');
            }
        }
    }
}

// ============================================================================
// Bridge with Token (ERC20)
// ============================================================================

async function bridgeUSDC() {
    console.log('\n' + '='.repeat(50));
    console.log(' Bridge USDC to Optimism');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    
    const USDC_BASE = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    const amount = parseUnits('50', 6); // 50 USDC

    console.log('\nNOTE Bridging 50 USDC from Base to Optimism...');

    try {
        const result = await sdk.bridge({
            targetChain: CHAIN_IDS.OPTIMISM_SEPOLIA,
            token: USDC_BASE,
            amount: amount,
        });

        console.log('OK USDC bridge initiated!');
        console.log(`   Source TX: ${result.sourceTxHash}`);
        console.log(`   VAA Sequence: ${result.vaaSequence}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Bridge to Solana
// ============================================================================

async function bridgeToSolana() {
    console.log('\n' + '='.repeat(50));
    console.log(' Bridge to Solana');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    console.log('\nNOTE Bridging 0.001 ETH from Base to Solana...');
    console.log('   (ETH becomes wETH on Solana)\n');

    try {
        const result = await sdk.bridge({
            targetChain: CHAIN_IDS.SOLANA_DEVNET,
            token: 'native',
            amount: parseEther('0.001'),
            // Solana uses base58 addresses
            // Defaults to your derived Solana address
        }, {
            onProgress: (progress) => {
                console.log(`   ${progress.stage}: ${progress.message || ''}`);
            },
        });

        console.log('\nOK Solana bridge complete!');
        console.log(`   Source TX (EVM): ${result.sourceTxHash}`);
        console.log(`   Target TX (Solana): ${result.targetTxHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Check VAA Status
// ============================================================================

async function checkVAAStatus() {
    console.log('\n' + '='.repeat(50));
    console.log(' Check VAA Status');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    // Example: Check status of a previous bridge
    const vaaSequence = 12345n; // Replace with actual sequence
    const emitterChain = CHAIN_IDS.BASE_SEPOLIA;

    console.log(`\nNOTE Checking VAA status for sequence ${vaaSequence}...`);

    try {
        const status = await sdk.getVAAStatus({
            sequence: vaaSequence,
            emitterChain: emitterChain,
        });

        console.log(`\n VAA Status:`);
        console.log(`   Sequence: ${status.sequence}`);
        console.log(`   Status: ${status.status}`);
        console.log(`   Signatures: ${status.signatures}/${status.requiredSignatures}`);
        console.log(`   Timestamp: ${new Date(status.timestamp * 1000).toISOString()}`);
        
        if (status.status === 'completed') {
            console.log(`   Target TX: ${status.targetTxHash}`);
        } else if (status.status === 'pending') {
            console.log(`   ETA: ~${status.estimatedTime} seconds`);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Multi-Chain Portfolio View
// ============================================================================

async function viewCrossChainPortfolio() {
    console.log('\n' + '='.repeat(50));
    console.log('NETWORK Cross-Chain Portfolio');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    console.log('\n Fetching balances across all chains...\n');

    const chains = ['base', 'optimism', 'arbitrum'] as const;

    console.log('Chain          | ETH            | USDC           ');
    console.log('-'.repeat(50));

    for (const chain of chains) {
        try {
            const chainSdk = createSDK(chain);
            const ethBalance = await chainSdk.getBalance('native');
            
            // Get USDC (address varies by chain)
            const usdcAddresses: Record<string, string> = {
                base: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                optimism: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
                arbitrum: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
            };
            
            let usdcBalance = 0n;
            try {
                usdcBalance = await chainSdk.getBalance(usdcAddresses[chain]);
            } catch {
                // Token might not exist on this chain
            }

            const ethStr = formatEther(ethBalance).slice(0, 12).padEnd(14);
            const usdcStr = formatUnits(usdcBalance, 6).slice(0, 12).padEnd(14);
            console.log(`${chain.padEnd(14)} | ${ethStr} | ${usdcStr}`);
        } catch (error) {
            console.log(`${chain.padEnd(14)} | Error          | Error          `);
        }
    }
}

// Run examples
main()
    .then(() => bridgeUSDC())
    .then(() => bridgeToSolana())
    .then(() => viewCrossChainPortfolio())
    .catch(console.error);
