/**
 * Example 01: Create a Veridex Wallet
 * 
 * This example demonstrates how to create a passkey-based wallet using the
 * Veridex SDK. The wallet address is deterministic and the same across all
 * EVM chains.
 * 
 * Run: npm run basic:wallet
 */

import { createSDK, getSupportedChains, getHubChains } from '@veridex/sdk';

async function main() {
    console.log('🔐 Veridex Wallet Creation Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================

    console.log('\n📡 Initializing SDK for Base testnet...');

    // The simplest way to create an SDK instance
    // Default network is 'testnet'
    const sdk = createSDK('base');

    console.log('✅ SDK initialized successfully');

    // Show supported chains
    console.log('\n📋 Supported chains:');
    const chains = getSupportedChains();
    console.log(`   Total: ${chains.length} chains`);
    console.log(`   Hub chains: ${getHubChains().join(', ')}`);

    // =========================================================================
    // Step 2: Register a Passkey
    // =========================================================================

    console.log('\n🔑 Registering passkey...');
    console.log('   (In a browser, this would trigger biometric prompt)\n');

    try {
        // In a real application, this triggers the WebAuthn registration flow
        // The user will see a biometric prompt (fingerprint, Face ID, etc.)
        const credential = await sdk.passkey.register(
            'user@example.com',  // Username (for display)
            'My First Wallet'     // Wallet name
        );

        console.log('✅ Passkey registered successfully!');
        console.log(`   Credential ID: ${credential.credentialId.slice(0, 20)}...`);
        console.log(`   Key Hash: ${credential.keyHash}`);

        // =====================================================================
        // Step 3: Get Your Vault Address
        // =====================================================================

        console.log('\n📍 Computing vault address...');

        // The vault address is deterministic - derived from your passkey
        // It's the SAME on all EVM chains!
        const vaultAddress = sdk.getVaultAddress();

        console.log(`\n✅ Your vault address: ${vaultAddress}`);
        console.log('\n   This address is the same on:');
        console.log('   • Base');
        console.log('   • Optimism');
        console.log('   • Arbitrum');
        console.log('   • Ethereum');
        console.log('   • And all other EVM chains!');

        // =====================================================================
        // Step 4: Get Unified Identity
        // =====================================================================

        console.log('\n🌐 Getting unified cross-chain identity...');

        const identity = await sdk.getUnifiedIdentity();

        console.log('\n📋 Unified Identity:');
        console.log(`   Key Hash: ${identity.keyHash}`);
        console.log(`   Addresses:`);

        for (const chainAddr of identity.addresses) {
            console.log(`   • ${chainAddr.chainName}: ${chainAddr.address} (${chainAddr.deployed ? 'Deployed' : 'Not Deployed'})`);
        }

        // =====================================================================
        // Step 5: Display Usage Instructions
        // =====================================================================

        console.log('\n' + '='.repeat(50));
        console.log('🚀 Next Steps:');
        console.log('='.repeat(50));
        console.log(`
1. Fund your vault at: ${vaultAddress}
   Send some testnet ETH to start using your wallet.

2. Check your balances (see 02-get-balances.ts)

3. Send tokens (see 03-send-tokens.ts)

4. Bridge cross-chain (see 04-cross-chain.ts)

5. Try gasless transactions (see 05-gasless.ts)
        `);

    } catch (error) {
        // Handle WebAuthn errors gracefully
        if (error instanceof Error) {
            if (error.message.includes('not supported')) {
                console.log('\n⚠️  WebAuthn is not supported in this environment.');
                console.log('   Please run this example in a browser with WebAuthn support.');
            } else if (error.message.includes('cancelled')) {
                console.log('\n⚠️  User cancelled the passkey registration.');
            } else {
                console.error('\n❌ Error:', error.message);
            }
        }
    }
}

// ============================================================================
// Alternative: Create SDKs for other chains
// ============================================================================

async function showMultiChainExample() {
    console.log('\n' + '='.repeat(50));
    console.log('🔗 Multi-Chain SDK Examples');
    console.log('='.repeat(50));

    // Create SDKs for different chains
    console.log('\n✅ Created SDKs for:');

    const chains = [
        { name: 'base', label: 'Base (testnet)' },
        { name: 'solana', label: 'Solana (devnet)' },
        { name: 'aptos', label: 'Aptos (testnet)' },
        { name: 'sui', label: 'Sui (testnet)' },
    ] as const;

    for (const { name, label } of chains) {
        try {
            createSDK(name);
            console.log(`   • ${label}`);
        } catch (e: any) {
            console.log(`   • ${label} [FAILED: ${e.message}]`);
        }
    }

    // Show mainnet example (will fail without contracts)
    console.log('\n🔧 Advanced configurations:');
    console.log('   • Custom RPC URL');
    console.log('   • Gasless relayer');
    console.log('   • Mainnet/testnet selection');
    console.log('\n💡 Note: Some chains require deployed contracts to function.');
    console.log('   Base testnet is fully configured and ready to use.');
}

// Run the example
main()
    .then(() => showMultiChainExample())
    .catch(console.error);
