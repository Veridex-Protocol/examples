/**
 * Example 02: Get Multi-Chain Balances
 * 
 * This example demonstrates how to query balances across multiple chains
 * for a Veridex vault.
 * 
 * Run: npx ts-node basic/02-get-balances.ts
 */

import { createSDK } from 'veridex-sdk';
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
    console.log('💰 Veridex Multi-Chain Balance Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK and get vault address
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\n📡 SDK initialized for Base testnet');
    
    // Assuming passkey already registered (from example 01)
    // In production, you'd load the existing credential
    const vaultAddress = sdk.getVaultAddress();
    
    console.log(`\n📍 Vault address: ${vaultAddress}`);

    // =========================================================================
    // Step 2: Get Native Token Balance
    // =========================================================================
    
    console.log('\n🔍 Fetching balances...\n');

    try {
        // Get native ETH balance on Base
        const nativeBalance = await sdk.getBalance('native');
        
        console.log('📊 Native Token Balances:');
        console.log(`   Base ETH: ${formatEther(nativeBalance)} ETH`);

        // =====================================================================
        // Step 3: Get ERC20 Token Balances
        // =====================================================================
        
        const usdcBalance = await sdk.getBalance(TOKENS.baseSepolia.USDC);
        console.log(`   Base USDC: ${formatUnits(usdcBalance, 6)} USDC`);

        // =====================================================================
        // Step 4: Get Multi-Chain Portfolio
        // =====================================================================
        
        console.log('\n🌐 Multi-Chain Portfolio:');
        console.log('-'.repeat(50));

        // Get balances across all configured chains
        const portfolio = await sdk.getVaultBalances();
        
        for (const chainBalance of portfolio) {
            console.log(`\n   ${chainBalance.chainName}:`);
            console.log(`   └─ Native: ${formatEther(chainBalance.nativeBalance)} ETH`);
            
            for (const token of chainBalance.tokens) {
                const formatted = formatUnits(token.balance, token.decimals);
                console.log(`   └─ ${token.symbol}: ${formatted}`);
            }
        }

        // =====================================================================
        // Step 5: Get Balance with Wormhole Query Proof
        // =====================================================================
        
        console.log('\n🔮 Guardian-Attested Balance Query:');
        console.log('-'.repeat(50));

        // This uses Wormhole Queries for cryptographic proof of balance
        // Useful for cross-chain verification
        const attestedPortfolio = await sdk.queryPortfolio([
            { chainId: 10004, tokens: ['native', TOKENS.baseSepolia.USDC] },
            { chainId: 10005, tokens: ['native'] },
        ]);

        console.log('\n   Attested balances (with Guardian signatures):');
        for (const entry of attestedPortfolio.balances) {
            console.log(`   Chain ${entry.chainId}: ${entry.balance}`);
        }
        console.log(`   Proof timestamp: ${new Date(attestedPortfolio.timestamp * 1000).toISOString()}`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Error fetching balances:', error.message);
            
            if (error.message.includes('not registered')) {
                console.log('\n💡 Tip: Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// Balance Manager with Caching
// ============================================================================

async function showBalanceManagerExample() {
    console.log('\n' + '='.repeat(50));
    console.log('📦 Balance Manager with Caching');
    console.log('='.repeat(50));

    const sdk = createSDK('base');

    // The SDK includes a BalanceManager that caches balances
    // to reduce RPC calls and improve performance

    console.log('\n🔄 First fetch (from RPC):');
    const start1 = Date.now();
    const balance1 = await sdk.getBalance('native');
    console.log(`   Time: ${Date.now() - start1}ms`);
    console.log(`   Balance: ${formatEther(balance1)} ETH`);

    console.log('\n⚡ Second fetch (from cache):');
    const start2 = Date.now();
    const balance2 = await sdk.getBalance('native');
    console.log(`   Time: ${Date.now() - start2}ms`);
    console.log(`   Balance: ${formatEther(balance2)} ETH`);

    // Force refresh if needed
    console.log('\n🔄 Force refresh:');
    const start3 = Date.now();
    const balance3 = await sdk.getBalance('native', { forceRefresh: true });
    console.log(`   Time: ${Date.now() - start3}ms`);
    console.log(`   Balance: ${formatEther(balance3)} ETH`);
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
    
    console.log('\n📊 Vault balances across chains:\n');
    console.log('Chain          | ETH Balance      | Status');
    console.log('-'.repeat(50));

    for (const chain of chains) {
        try {
            const sdk = createSDK(chain);
            const balance = await sdk.getBalance('native');
            const formatted = formatEther(balance).padEnd(16);
            console.log(`${chain.padEnd(14)} | ${formatted} | ✅`);
        } catch (error) {
            console.log(`${chain.padEnd(14)} | N/A              | ❌ Error`);
        }
    }
}

// Run examples
main()
    .then(() => showBalanceManagerExample())
    .then(() => showCrossChainBalances())
    .catch(console.error);
