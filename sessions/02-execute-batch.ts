/**
 * Session Example 02: Execute Batch Transactions
 * 
 * This example demonstrates how to execute multiple transactions
 * using a session key without repeated passkey prompts.
 * 
 * Run: npm run session:execute
 */

import { createSDK, SessionManager, EVMHubClientAdapter } from '@veridex/sdk';
import { parseEther, formatEther, Wallet, JsonRpcProvider, getBytes } from 'ethers';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RECIPIENTS = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7',
    '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
];

async function main() {
    console.log('📦 Execute Batch Transactions with Session\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK and Session Manager
    // =========================================================================
    
    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    console.log('\n📡 SDK initialized for Base testnet');
    console.log(`💳 Signer address: ${signer.address}`);
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`📍 Vault address: ${vaultAddress}`);

        const credential = sdk.getCredential();
        if (!credential) {
            throw new Error('No credential set. Run 01-create-wallet.ts first.');
        }

        const hubClient = new EVMHubClientAdapter(sdk.getChainClient() as any, signer as any);
        const sessionManager = new SessionManager(
            credential,
            hubClient,
            (challenge) => sdk.passkey.sign(challenge),
            { duration: 3600, maxValue: parseEther('0.1') },
        );

        // =====================================================================
        // Step 2: Create or Load Session
        // =====================================================================
        
        console.log('\n🔑 Setting up session...');
        
        // Try to load existing session from storage
        let session = await sessionManager.loadSession();
        
        if (session) {
            console.log('✅ Using existing session');
            console.log(`   Expires: ${new Date(session.expiry).toISOString()}`);
        } else {
            console.log('   Creating new session...');
            session = await sessionManager.createSession();
            console.log('✅ New session created');
        }

        // =====================================================================
        // Step 3: Check Balance
        // =====================================================================
        
        console.log('\n💰 Checking balance...');
        
        const balance = await sdk.getVaultNativeBalance();
        console.log(`   Balance: ${balance.formatted} ETH`);

        const totalNeeded = parseEther('0.0003'); // 0.0001 ETH × 3 recipients
        if (balance.balance < totalNeeded) {
            console.log('\n⚠️  Insufficient balance for batch transactions.');
            console.log(`   Need: ${formatEther(totalNeeded)} ETH`);
            console.log(`   Have: ${balance.formatted} ETH`);
            return;
        }

        // =====================================================================
        // Step 4: Execute Batch Transactions
        // =====================================================================
        
        console.log('\n📦 Executing batch transactions...');
        console.log('   (No passkey prompts needed!)\n');

        const chainConfig = sdk.getChainConfig();
        const results = [];

        for (let i = 0; i < RECIPIENTS.length; i++) {
            const recipient = RECIPIENTS[i];
            const amount = parseEther('0.0001');

            console.log(`   Transaction ${i + 1}/${RECIPIENTS.length}:`);
            console.log(`   → To: ${recipient}`);
            console.log(`   → Amount: ${formatEther(amount)} ETH`);

            try {
                // Sign the action with the session key (instant, no biometric)
                const actionPayload = await sdk.buildTransferPayload({
                    targetChain: chainConfig.wormholeChainId,
                    token: 'native',
                    recipient,
                    amount,
                });
                const signed = await sessionManager.signAction({
                    action: 'transfer',
                    targetChain: chainConfig.wormholeChainId,
                    payload: getBytes(actionPayload),
                    nonce: Number(await sdk.getNonce()),
                    value: amount,
                });

                console.log(`   ✅ Signed: ${signed.signature.sessionKeyHash.slice(0, 20)}...`);
                results.push({ success: true, hash: signed.signature.sessionKeyHash });
            } catch (error: any) {
                console.log(`   ❌ Failed: ${error.message}`);
                results.push({ success: false, error: error.message });
            }

            // Small delay between transactions
            if (i < RECIPIENTS.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // =====================================================================
        // Step 5: Summary
        // =====================================================================
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 Batch Execution Summary');
        console.log('='.repeat(50));

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`\n   Total Transactions: ${results.length}`);
        console.log(`   Successful: ${successful} ✅`);
        console.log(`   Failed: ${failed} ❌`);
        console.log(`   Total Sent: ${formatEther(parseEther('0.0001') * BigInt(successful))} ETH`);

        // =====================================================================
        // Step 6: Check Updated Balance
        // =====================================================================
        
        console.log('\n💰 Updated balance:');
        
        // Invalidate cache
        sdk.balance.invalidateCache(chainConfig.wormholeChainId, vaultAddress);
        
        const newBalance = await sdk.getVaultNativeBalance();
        console.log(`   New balance: ${newBalance.formatted} ETH`);
        console.log(`   Difference: ${formatEther(balance.balance - newBalance.balance)} ETH`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Error:', error.message);
            
            if (error.message.includes('No credential')) {
                console.log('\n💡 Run basic/01-create-wallet.ts first to register a passkey.');
            } else if (error.message.includes('session')) {
                console.log('\n💡 Run sessions/01-create-session.ts first to create a session.');
            }
        }
    }
}

// ============================================================================
// Parallel Batch Execution
// ============================================================================

async function executeParallelBatch() {
    console.log('\n' + '='.repeat(50));
    console.log('⚡ Parallel Batch Execution');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);

    try {
        const credential = sdk.getCredential();
        if (!credential) {
            console.log('   ⚠️  No credential set. Run 01-create-wallet.ts first.');
            return;
        }

        const hubClient = new EVMHubClientAdapter(sdk.getChainClient() as any, signer as any);
        const sessionManager = new SessionManager(
            credential,
            hubClient,
            (challenge) => sdk.passkey.sign(challenge),
            { duration: 3600, maxValue: parseEther('0.1') },
        );

        const session = await sessionManager.loadSession();
        if (!session) {
            console.log('   ⚠️  No active sessions. Run 01-create-session.ts first.');
            return;
        }

        const chainConfig = sdk.getChainConfig();

        console.log('\n📦 Signing transactions in parallel...\n');

        const promises = RECIPIENTS.map(async (recipient, i) => {
            try {
                const actionPayload = await sdk.buildTransferPayload({
                    targetChain: chainConfig.wormholeChainId,
                    token: 'native',
                    recipient,
                    amount: parseEther('0.0001'),
                });
                const signed = await sessionManager.signAction({
                    action: 'transfer',
                    targetChain: chainConfig.wormholeChainId,
                    payload: getBytes(actionPayload),
                    nonce: Number(await sdk.getNonce()),
                    value: parseEther('0.0001'),
                });
                console.log(`   ✅ Transaction ${i + 1} signed`);
                return { success: true, hash: signed.signature.sessionKeyHash };
            } catch (error: any) {
                console.log(`   ❌ Transaction ${i + 1} failed`);
                return { success: false, error: error.message };
            }
        });

        const results = await Promise.all(promises);

        const successful = results.filter(r => r.success).length;
        console.log(`\n✅ Signed ${successful}/${results.length} transactions in parallel`);

    } catch (error) {
        console.log('   ⚠️  Skipped (no credential or session)');
    }
}

// ============================================================================
// Session Usage Patterns
// ============================================================================

async function showUsagePatterns() {
    console.log('\n' + '='.repeat(50));
    console.log('💡 Session Usage Patterns');
    console.log('='.repeat(50));

    console.log(`
1. Sequential Batch:
   • Execute transactions one after another
   • Easier error handling
   • Predictable nonce management
   • Slower overall execution

2. Parallel Batch:
   • Execute multiple transactions simultaneously
   • Faster overall execution
   • Requires careful nonce management
   • More complex error handling

3. Conditional Batch:
   • Execute next transaction based on previous result
   • Useful for dependent operations
   • Better error recovery
   • More flexible logic

4. Scheduled Batch:
   • Execute transactions at specific times
   • Useful for automation
   • Requires persistent session storage
   • Consider session expiry

Best Practices:
  • Check session validity before batch
  • Handle individual transaction failures
  • Monitor session value limits
  • Refresh session if needed
  • Revoke session after batch complete
    `);
}

// ============================================================================
// Error Handling Guide
// ============================================================================

async function showErrorHandling() {
    console.log('\n' + '='.repeat(50));
    console.log('⚠️  Error Handling Guide');
    console.log('='.repeat(50));

    console.log(`
Common Errors:

1. "Session expired"
   → Create new session or refresh existing one

2. "Value exceeds session limit"
   → Reduce transaction amount or create new session with higher limit

3. "Session not active"
   → Session was revoked or never created

4. "Insufficient balance"
   → Fund vault before executing batch

5. "Nonce too low"
   → Wait for previous transaction to confirm

6. "Gas estimation failed"
   → Check recipient address and token balance

Recovery Strategies:

• Retry failed transactions individually
• Create new session if current one expired
• Implement exponential backoff for retries
• Log all transaction attempts for debugging
• Monitor session status throughout batch
    `);
}

// Run examples
main()
    .then(() => executeParallelBatch())
    .then(() => showUsagePatterns())
    .then(() => showErrorHandling())
    .catch(console.error);
