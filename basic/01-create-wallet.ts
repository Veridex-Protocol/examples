/**
 * Example 01: Create a Veridex Wallet
 * 
 * This example demonstrates how to create a passkey-based wallet using the
 * Veridex SDK. The wallet address is deterministic and the same across all
 * EVM chains.
 * 
 * Run: npx ts-node basic/01-create-wallet.ts
 */

import { createSDK, getSupportedChains, getHubChains } from '@veridex/sdk';

// Polyfill window for Node.js environment to prevent crashes checks
if (typeof window === 'undefined') {
    (global as any).window = {
        location: {
            hostname: 'localhost'
        },
        navigator: {
            credentials: {
                create: async () => {
                    throw new Error('WebAuthn is not supported in this environment');
                }
            }
        }
    };
    (global as any).localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { }
    };
}

async function main() {
    console.log('SECURITY Veridex Wallet Creation Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK (just specify chain name!)
    // =========================================================================

    console.log('\nRPC Initializing SDK for Base testnet...');

    // The simplest way to create an SDK instance
    // Default network is 'testnet'
    const sdk = createSDK('base');

    console.log('OK SDK initialized successfully');

    // Show supported chains
    console.log('\nNOTE Supported chains:');
    const chains = getSupportedChains();
    console.log(`   Total: ${chains.length} chains`);
    console.log(`   Hub chains: ${getHubChains().join(', ')}`);

    // =========================================================================
    // Step 2: Register a Passkey
    // =========================================================================

    console.log('\n Registering passkey...');
    console.log('   (In a browser, this would trigger biometric prompt)\n');

    try {
        // In a real application, this triggers the WebAuthn registration flow
        // The user will see a biometric prompt (fingerprint, Face ID, etc.)
        const credential = await sdk.passkey.register(
            'user@example.com',  // Username (for display)
            'My First Wallet'     // Wallet name
        );

        console.log('OK Passkey registered successfully!');
        console.log(`   Credential ID: ${credential.credentialId.slice(0, 20)}...`);
        console.log(`   Key Hash: ${credential.keyHash}`);
        console.log(`   Public Key X: ${credential.publicKeyX.toString().slice(0, 20)}...`);
        console.log(`   Public Key Y: ${credential.publicKeyY.toString().slice(0, 20)}...`);

        // =====================================================================
        // Step 3: Get Your Vault Address
        // =====================================================================

        console.log('\nLOCATION Computing vault address...');

        // The vault address is deterministic - derived from your passkey
        // It's the SAME on all EVM chains!
        const vaultAddress = sdk.getVaultAddress();

        console.log(`\nDONE Your vault address: ${vaultAddress}`);
        console.log('\n   This address is the same on:');
        console.log('   • Base');
        console.log('   • Optimism');
        console.log('   • Arbitrum');
        console.log('   • Ethereum');
        console.log('   • And all other EVM chains!');

        // =====================================================================
        // Step 4: Get Unified Identity
        // =====================================================================

        console.log('\nNETWORK Getting unified cross-chain identity...');

        const identity = await sdk.getUnifiedIdentity();

        console.log('\nNOTE Unified Identity:');
        console.log(`   Key Hash: ${identity.keyHash}`);
        console.log(`   Addresses:`);

        for (const chainAddr of identity.addresses) {
            console.log(`   • ${chainAddr.chainName}: ${chainAddr.address} (${chainAddr.deployed ? 'Deployed' : 'Not Deployed'})`);
        }

        // =====================================================================
        // Step 5: Display Usage Instructions
        // =====================================================================

        console.log('\n' + '='.repeat(50));
        console.log('START Next Steps:');
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
                console.log('\nWARN  WebAuthn is not supported in this environment.');
                console.log('   Please run this example in a browser with WebAuthn support.');
            } else if (error.message.includes('cancelled')) {
                console.log('\nWARN  User cancelled the passkey registration.');
            } else {
                console.error('\nERROR Error:', error.message);
            }
        }
    }
}

// ============================================================================
// Alternative: Create SDKs for other chains
// ============================================================================

async function showMultiChainExample() {
    console.log('\n' + '='.repeat(50));
    console.log('LINK Multi-Chain SDK Examples');
    console.log('='.repeat(50));

    // Create SDKs for different chains
    console.log('\nOK Created SDKs for:');

    try {
        createSDK('base');
        console.log('   • Base (testnet)');
    } catch (e: any) {
        console.log(`   • Base (testnet) [FAILED: ${e.message}]`);
    }

    try {
        createSDK('optimism');
        console.log('   • Optimism (testnet)');
    } catch (e: any) {
        console.log(`   • Optimism (testnet) [SKIPPED: ${e.message}]`);
    }

    try {
        createSDK('arbitrum');
        console.log('   • Arbitrum (testnet)');
    } catch (e: any) {
        console.log(`   • Arbitrum (testnet) [SKIPPED: ${e.message}]`);
    }

    try {
        createSDK('solana');
        console.log('   • Solana (devnet)');
    } catch (e: any) {
        console.log(`   • Solana (devnet) [SKIPPED: ${e.message}]`);
    }

    // For mainnet, specify the network
    try {
        createSDK('base', { network: 'mainnet' });
        console.log('   • Base (mainnet)');
    } catch (e: any) {
        console.log(`   • Base (mainnet) [SKIPPED: ${e.message}]`);
    }

    // With custom RPC
    try {
        createSDK('base', {
            rpcUrl: 'https://my-custom-rpc.example.com',
        });
        console.log('   • Base with custom RPC');
    } catch (e: any) {
        console.log(`   • Base with custom RPC [SKIPPED: ${e.message}]`);
    }

    // With relayer for gasless transactions
    try {
        createSDK('base', {
            relayerUrl: 'https://amused-kameko-veridex-demo-37453117.koyeb.app',
            // relayerApiKey: 'your-api-key',
        });
        console.log('   • Base with gasless relayer');
    } catch (e: any) {
        console.log(`   • Base with gasless relayer [SKIPPED: ${e.message}]`);
    }
}

// Run the example
main()
    .then(() => showMultiChainExample())
    .catch(console.error);
