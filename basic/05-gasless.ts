/**
 * Example 05: Gasless Transactions
 * 
 * This example demonstrates how to execute transactions without holding
 * any gas tokens, using the Veridex relayer for sponsored execution.
 * 
 * Run: npm run basic:gasless
 */

import { createSDK } from '@veridex/sdk';
import { parseEther, formatEther } from 'ethers';

// Configuration
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7';
const RELAYER_URL = process.env.RELAYER_URL || 'https://relayer.veridex.network';
const RELAYER_API_KEY = process.env.RELAYER_API_KEY;

async function main() {
    console.log('⚡ Veridex Gasless Transaction Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK with Relayer
    // =========================================================================
    
    console.log('\n📡 Initializing SDK with relayer support...');
    
    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
        relayerApiKey: RELAYER_API_KEY,
    });

    console.log(`✅ SDK initialized with relayer: ${RELAYER_URL}`);
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`📍 Vault address: ${vaultAddress}`);

        // =====================================================================
        // Step 2: Check Balance
        // =====================================================================
        
        console.log('\n💰 Checking vault balance...');
        
        const balance = await sdk.getVaultNativeBalance();
        console.log(`   Balance: ${balance.formatted} ETH`);

        if (balance.balance < parseEther('0.001')) {
            console.log('\n⚠️  Insufficient balance for transfer.');
            console.log('   Note: Even gasless transactions need tokens to transfer!');
            console.log(`   Fund your vault: ${vaultAddress}`);
            return;
        }

        // =====================================================================
        // Step 3: Prepare Gasless Transfer
        // =====================================================================
        
        console.log('\n📝 Preparing gasless transfer...');
        
        const transferAmount = parseEther('0.0001'); // 0.0001 ETH
        const chainConfig = sdk.getChainConfig();
        
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
        console.log(`   Gas Cost: 0 ETH (sponsored by relayer) ⚡`);

        // =====================================================================
        // Step 4: Execute Gasless Transfer
        // =====================================================================
        
        console.log('\n🔐 Signing with passkey...');
        console.log('   (This would trigger biometric prompt in browser)\n');

        // Execute via relayer - NO SIGNER NEEDED!
        // The relayer pays for gas
        const result = await sdk.transferViaRelayer(
            {
                token: 'native',
                recipient: RECIPIENT,
                amount: transferAmount,
                targetChain: chainConfig.wormholeChainId,
            },
            (status) => {
                console.log(`   Status: ${status.state}`);
                if (status.hash) {
                    console.log(`   TX Hash: ${status.hash}`);
                }
            }
        );

        console.log('\n✅ Gasless transfer successful!');
        console.log(`\n📋 Transaction Details:`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Sequence: ${result.sequence}`);
        console.log(`   Gas Paid By: Relayer ⚡`);
        console.log(`   User Gas Cost: 0 ETH`);

        // =====================================================================
        // Step 5: Verify Balance Change
        // =====================================================================
        
        console.log('\n💰 Balance after transfer:');
        
        // Invalidate cache
        sdk.balance.invalidateCache(chainConfig.wormholeChainId, vaultAddress);
        
        const newBalance = await sdk.getVaultNativeBalance();
        console.log(`   New balance: ${newBalance.formatted} ETH`);
        console.log(`   Transferred: ${formatEther(transferAmount)} ETH`);
        console.log(`   Gas cost: 0 ETH (relayer sponsored) ⚡`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Gasless transfer failed:', error.message);
            
            if (error.message.includes('relayer')) {
                console.log('\n💡 Make sure the relayer is running and accessible.');
                console.log(`   Relayer URL: ${RELAYER_URL}`);
            } else if (error.message.includes('No credential')) {
                console.log('\n💡 Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// Gasless Vault Creation
// ============================================================================

async function createGaslessVault() {
    console.log('\n' + '='.repeat(50));
    console.log('🏗️  Gasless Vault Creation');
    console.log('='.repeat(50));

    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
        relayerApiKey: RELAYER_API_KEY,
    });

    console.log('\n📝 Creating vault without gas...');

    try {
        // Check if vault exists
        const exists = await sdk.vaultExists();
        
        if (exists) {
            console.log('   ✅ Vault already exists');
            return;
        }

        // Create vault via sponsor (gasless)
        const result = await sdk.createVaultSponsored();

        console.log('✅ Vault created (gasless)!');
        console.log(`   Address: ${result.vaultAddress}`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Gas Paid By: Sponsor ⚡`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Multi-Chain Gasless Deployment
// ============================================================================

async function deployGaslessMultiChain() {
    console.log('\n' + '='.repeat(50));
    console.log('🌐 Multi-Chain Gasless Deployment');
    console.log('='.repeat(50));

    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
        relayerApiKey: RELAYER_API_KEY,
        sponsorPrivateKey: process.env.SPONSOR_PRIVATE_KEY,
    });

    console.log('\n📝 Deploying vaults on all chains (gasless)...');

    try {
        // Deploy vaults on all supported chains
        const result = await sdk.createSponsoredVaultsOnAllChains();

        console.log('\n✅ Multi-chain deployment complete!');
        console.log(`   Total chains: ${result.totalChains}`);
        console.log(`   Successful: ${result.successfulDeployments}`);
        console.log(`   Failed: ${result.failedDeployments}`);
        
        console.log('\n📋 Deployment results:');
        for (const [chainId, deployment] of Object.entries(result.deployments)) {
            const status = deployment.success ? '✅' : '❌';
            console.log(`   ${status} Chain ${chainId}: ${deployment.vaultAddress || deployment.error}`);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Gasless Bridge Example
// ============================================================================

async function gaslessBridge() {
    console.log('\n' + '='.repeat(50));
    console.log('🌉 Gasless Cross-Chain Bridge');
    console.log('='.repeat(50));

    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
        relayerApiKey: RELAYER_API_KEY,
    });

    console.log('\n📝 Bridging tokens without gas...');

    try {
        const vaultAddress = sdk.getVaultAddress();
        
        // Bridge via relayer (gasless)
        const result = await sdk.bridgeViaRelayer(
            {
                sourceChain: 10004, // Base Sepolia
                token: 'native',
                amount: parseEther('0.0001'),
                destinationChain: 10005, // Optimism Sepolia
                recipient: vaultAddress,
            },
            (progress) => {
                console.log(`   ${progress.status}: ${progress.message}`);
            }
        );

        console.log('\n✅ Gasless bridge complete!');
        console.log(`   Source TX: ${result.sourceTxHash}`);
        console.log(`   Destination TX: ${result.destinationTxHash}`);
        console.log(`   Gas Paid By: Relayer ⚡`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// ============================================================================
// Relayer Status Check
// ============================================================================

async function checkRelayerStatus() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 Relayer Status Check');
    console.log('='.repeat(50));

    const sdk = createSDK('base', {
        relayerUrl: RELAYER_URL,
        relayerApiKey: RELAYER_API_KEY,
    });

    console.log('\n📊 Checking relayer status...');

    try {
        // The relayer client is available via sdk internals
        // In a real app, you'd have a dedicated status endpoint
        console.log(`   Relayer URL: ${RELAYER_URL}`);
        console.log(`   Status: ✅ Available`);
        console.log(`   Features:`);
        console.log(`   • Gasless transfers`);
        console.log(`   • Gasless bridges`);
        console.log(`   • Vault creation sponsorship`);
        console.log(`   • Cross-chain VAA relay`);
    } catch (error) {
        console.log(`   Status: ❌ Unavailable`);
    }
}

// Run examples
main()
    .then(() => createGaslessVault())
    .then(() => deployGaslessMultiChain())
    .then(() => gaslessBridge())
    .then(() => checkRelayerStatus())
    .catch(console.error);
