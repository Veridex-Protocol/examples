/**
 * Example 04: Cross-Chain Transfers
 * 
 * This example demonstrates how to bridge tokens between chains using
 * Veridex and Wormhole for secure cross-chain messaging.
 * 
 * Run: npx ts-node basic/04-cross-chain.ts
 */

import { createSDK, CHAIN_PRESETS } from '@veridex/sdk';
import { parseEther, parseUnits, formatEther, formatUnits, Wallet, JsonRpcProvider } from 'ethers';

// Wormhole Chain IDs
const CHAIN_IDS = {
    BASE_SEPOLIA: 10004,
    OPTIMISM_SEPOLIA: 10005,
    ARBITRUM_SEPOLIA: 10003,
    SOLANA_DEVNET: 1,
};

// For this example to work in Node.js, we need an EOA to pay for gas
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function main() {
    console.log('BRIDGE Veridex Cross-Chain Transfer Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================
    
    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    console.log('\nRPC SDK initialized for Base testnet (Hub chain)');
    
    const vaultAddress = sdk.getVaultAddress();
    console.log(`LOCATION Your vault: ${vaultAddress}`);

    // =========================================================================
    // Step 2: Check Source Chain Balance
    // =========================================================================
    
    console.log('\nBALANCE Checking Base balance...');
    
    try {
        const balanceResult = await sdk.getVaultNativeBalance();
        const balance = balanceResult.balance;
        console.log(`   Balance: ${balanceResult.formatted} ETH`);

        if (balance < parseEther('0.01')) {
            console.log('\nWARN  Minimum 0.01 ETH needed for cross-chain transfer.');
            console.log('   Bridge fees + gas required.');
            return;
        }

        // =====================================================================
        // Step 3: Get Bridge Fees
        // =====================================================================
        
        console.log('\n Getting bridge fees...');
        
        const bridgeAmount = parseEther('0.005');
        
        const fees = await sdk.getBridgeFees({
            sourceChain: CHAIN_IDS.BASE_SEPOLIA,
            destinationChain: CHAIN_IDS.OPTIMISM_SEPOLIA,
            token: 'native',
            amount: bridgeAmount,
            recipient: vaultAddress,
        });

        console.log(`\nNOTE Bridge Fees:`);
        console.log(`   Source: Base Sepolia`);
        console.log(`   Target: Optimism Sepolia`);
        console.log(`   Amount: ${formatEther(bridgeAmount)} ETH`);
        console.log(`   Message Fee: ${formatEther(fees.messageFee)} ETH`);
        console.log(`   Relayer Fee: ${formatEther(fees.relayerFee)} ETH`);
        console.log(`   Total Cost: ${fees.formattedTotal}`);

        // =====================================================================
        // Step 4: Execute Bridge Transfer
        // =====================================================================
        
        console.log('\nSECURITY Initiating cross-chain transfer...');
        console.log('   (This triggers passkey signature)\n');

        const result = await sdk.bridgeWithTracking({
            sourceChain: CHAIN_IDS.BASE_SEPOLIA,
            destinationChain: CHAIN_IDS.OPTIMISM_SEPOLIA,
            token: 'native',
            amount: bridgeAmount,
            recipient: vaultAddress,
        }, signer, (progress) => {
            console.log(`   [${progress.step}/${progress.totalSteps}] ${progress.status}: ${progress.message}`);
        });

        console.log('\nDONE Cross-chain transfer successful!');
        console.log(`\nNOTE Transaction Details:`);
        console.log(`   Source TX: ${result.transactionHash}`);
        console.log(`   Sequence: ${result.sequence}`);
        console.log(`   VAA Ready: ${!!result.vaa}`);

        // =====================================================================
        // Step 5: Verify on Target Chain
        // =====================================================================
        
        console.log('\nVERIFY Verifying on Optimism...');
        
        const optimismSdk = createSDK('optimism');
        const newBalance = await optimismSdk.getVaultNativeBalance();
        console.log(`   Optimism Balance: ${newBalance.formatted} ETH`);

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
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);

    console.log('\nNOTE Bridging 0.001 ETH from Base to Solana...');
    console.log('   (ETH becomes wETH on Solana)\n');

    try {
        const result = await sdk.bridgeWithTracking({
            sourceChain: CHAIN_IDS.BASE_SEPOLIA,
            destinationChain: CHAIN_IDS.SOLANA_DEVNET,
            token: 'native',
            amount: parseEther('0.001'),
            recipient: sdk.getVaultAddress(), // In reality would be a Solana address
        }, signer, (progress) => {
            console.log(`   ${progress.status}: ${progress.message}`);
        });

        console.log('\nOK Solana bridge complete!');
        console.log(`   Source TX: ${result.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Fetch VAA
// ============================================================================

async function fetchVAA() {
    console.log('\n' + '='.repeat(50));
    console.log(' Fetch VAA');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    // Example: Fetch VAA for a previous bridge
    const txHash = '0x...'; // Replace with actual tx hash

    console.log(`\nNOTE Fetching VAA for transaction ${txHash}...`);

    try {
        const vaa = await sdk.fetchVAAForTransaction(txHash);
        console.log(`   VAA (base64): ${vaa.slice(0, 50)}...`);
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

    try {
        const portfolio = await sdk.getMultiChainBalances([10004, 10005, 10003]);
        for (const chain of portfolio) {
            console.log(`   ${chain.chainName}: ${chain.tokens[0]?.formatted || '0'} ETH`);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }
}

// Run all
main()
    .then(() => bridgeToSolana())
    .then(() => viewCrossChainPortfolio())
    .catch(console.error);
