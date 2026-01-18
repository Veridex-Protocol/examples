/**
 * Example 02: Get Multi-Chain Balances
 * 
 * This example demonstrates how to query balances across multiple chains
 * for a Veridex vault.
 * 
 * Run: npx ts-node basic/02-get-balances.ts
 */

import { createSDK } from '@veridex/sdk';
import { formatEther, formatUnits } from 'ethers';

// Token addresses for reference
const TOKENS = {
    baseSepolia: {
        USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        WETH: '0x4200000000000000000000000000000000000006',
    },
    optimismSepolia: {
        USDC: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
        WETH: '0x4200000000000000000000000000000000000006',
    },
};

async function main() {
    console.log('BALANCE Veridex Multi-Chain Balance Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK and get vault address
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\nRPC SDK initialized for Base testnet');
    
    // Assuming passkey already registered (from example 01)
    // In production, you'd load the existing credential
    const vaultAddress = sdk.getVaultAddress();
    
    console.log(`\nLOCATION Vault address: ${vaultAddress}`);

    // =========================================================================
    // Step 2: Get Native Token Balance
    // =========================================================================
    
    console.log('\nVERIFY Fetching balances...\n');

    try {
        // Get native ETH balance on Base
        const nativeBalance = await sdk.getVaultNativeBalance();
        
        console.log(' Native Token Balances:');
        console.log(`   Base ETH: ${nativeBalance.formatted} ETH`);

        // =====================================================================
        // Step 3: Get ERC20 Token Balances
        // =====================================================================
        
        const usdcBalance = await sdk.getVaultTokenBalance(TOKENS.baseSepolia.USDC);
        console.log(`   Base USDC: ${usdcBalance.formatted} USDC`);

        // =====================================================================
        // Step 4: Get Multi-Chain Portfolio
        // =====================================================================
        
        console.log('\nNETWORK Multi-Chain Portfolio:');
        console.log('-'.repeat(50));

        // Get balances across common testnet chains
        const portfolio = await sdk.getMultiChainBalances([10004, 10005, 10003]);
        
        for (const chainBalance of portfolio) {
            console.log(`\n   ${chainBalance.chainName}:`);
            const native = chainBalance.tokens.find(t => t.token.isNative);
            console.log(`   └─ Native: ${native?.formatted || '0'} ${native?.token.symbol || 'ETH'}`);
            
            for (const token of chainBalance.tokens.filter(t => !t.token.isNative)) {
                console.log(`   └─ ${token.token.symbol}: ${token.formatted}`);
            }
        }

        // =====================================================================
        // Step 5: Get Balance with Wormhole Query Proof
        // =====================================================================
        
        console.log('\nQUERIES Guardian-Attested Balance Query:');
        console.log('-'.repeat(50));

        // In the current SDK, multi-chain balances automatically use Queries if a queryApiKey is provided
        // This provides cryptographic proof of balance useful for cross-chain verification
        const multiChainResults = await sdk.getMultiChainBalances([10004, 10005]);

        console.log('\n   Attested balances (via Wormhole Queries):');
        for (const entry of multiChainResults) {
            const eth = entry.tokens.find(t => t.token.symbol === 'ETH');
            console.log(`   Chain ${entry.wormholeChainId} (${entry.chainName}): ${eth?.formatted || '0'} ETH`);
        }
        console.log(`   Query time: ${new Date().toISOString()}`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\nERROR Error fetching balances:', error.message);
            
            if (error.message.includes('not registered')) {
                console.log('\n Tip: Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// Balance Manager with Caching
// ============================================================================

async function showBalanceManagerExample() {
    console.log('\n' + '='.repeat(50));
    console.log('PACKAGE Balance Manager with Caching');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    // The SDK includes a BalanceManager that caches balances
    // to reduce RPC calls and improve performance

    console.log('\nIN PROGRESS First fetch (from RPC):');
    const start1 = Date.now();
    const balance1 = await sdk.getVaultNativeBalance();
    console.log(`   Time: ${Date.now() - start1}ms`);
    console.log(`   Balance: ${balance1.formatted} ETH`);

    console.log('\nFAST Second fetch (from cache):');
    const start2 = Date.now();
    const balance2 = await sdk.getVaultNativeBalance();
    console.log(`   Time: ${Date.now() - start2}ms`);
    console.log(`   Balance: ${balance2.formatted} ETH`);

    // Invalidate cache if needed
    console.log('\nIN PROGRESS Invalidate cache:');
    const start3 = Date.now();
    const vaultAddress = sdk.getVaultAddress();
    sdk.balance.invalidateCache(10004, vaultAddress); // Base Sepolia
    const balance3 = await sdk.getVaultNativeBalance();
    console.log(`   Time: ${Date.now() - start3}ms`);
    console.log(`   Balance: ${balance3.formatted} ETH`);
}

// ============================================================================
// Cross-Chain Balance Comparison
// ============================================================================

async function showCrossChainBalances() {
    console.log('\n' + '='.repeat(50));
    console.log('LINK Cross-Chain Balance Comparison');
    console.log('='.repeat(50));

    // Create SDKs for multiple chains
    const chains = ['base', 'optimism', 'arbitrum'] as const;
    
    console.log('\n Vault balances across chains:\n');
    console.log('Chain          | ETH Balance      | Status');
    console.log('-'.repeat(50));

    for (const chain of chains) {
        try {
            const sdk = createSDK(chain);
            const balance = await sdk.getVaultNativeBalance();
            const formatted = balance.formatted.padEnd(16);
            console.log(`${chain.padEnd(14)} | ${formatted} | OK`);
        } catch (error) {
            console.log(`${chain.padEnd(14)} | N/A              | ERROR`);
        }
    }
}

// Run examples
main()
    .then(() => showBalanceManagerExample())
    .then(() => showCrossChainBalances())
    .catch(console.error);
