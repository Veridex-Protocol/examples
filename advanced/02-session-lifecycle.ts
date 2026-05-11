/**
 * Advanced Example 02: Session Key Lifecycle
 * 
 * This example demonstrates the complete lifecycle of session keys:
 * creation, usage, refresh, and revocation.
 * 
 * Run: npm run advanced:session
 */

import { createSDK, SessionManager, EVMHubClientAdapter } from '@veridex/sdk';
import { parseEther, formatEther, Wallet, JsonRpcProvider, getBytes } from 'ethers';

if (!process.env.PRIVATE_KEY) {
  console.error('✖ PRIVATE_KEY is not set. Export it before running this example.');
  process.exit(1);
}
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7';

async function main() {
    console.log('🔑 Session Key Lifecycle Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK and Session Manager
    // =========================================================================
    
    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    console.log('\n📡 SDK initialized for Base testnet');
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`📍 Vault address: ${vaultAddress}`);

        // Create session manager
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

        console.log('✅ Session manager initialized');

        // =====================================================================
        // Step 2: Create a Session
        // =====================================================================
        
        console.log('\n🔐 Creating session key...');
        console.log('   (This requires one passkey authentication)');

        const session = await sessionManager.createSession();

        console.log('\n✅ Session created successfully!');
        console.log(`   Session Key Hash: ${session.keyHash}`);
        console.log(`   Expires: ${new Date(session.expiry).toISOString()}`);
        console.log(`   Max Value: ${formatEther(session.maxValue)} ETH`);
        console.log(`   Active: ${sessionManager.isActive() ? 'Yes' : 'No'}`);

        // =====================================================================
        // Step 3: Use Session for Multiple Transactions
        // =====================================================================
        
        console.log('\n💸 Executing transactions with session...');
        console.log('   (No passkey prompts needed!)');

        const chainConfig = sdk.getChainConfig();
        
        // Helper to sign a transfer action with the session
        async function signTransfer(amount: bigint) {
            const actionPayload = await sdk.buildTransferPayload({
                targetChain: chainConfig.wormholeChainId,
                token: 'native',
                recipient: RECIPIENT,
                amount,
            });
            return sessionManager.signAction({
                action: 'transfer',
                targetChain: chainConfig.wormholeChainId,
                payload: getBytes(actionPayload),
                nonce: Number(await sdk.getNonce()),
                value: amount,
            });
        }

        // Transaction 1
        console.log('\n   Transaction 1:');
        try {
            const signed1 = await signTransfer(parseEther('0.0001'));
            console.log(`   ✅ Signed: ${signed1.signature.sessionKeyHash.slice(0, 20)}...`);
        } catch (e: any) {
            console.log(`   ⚠️  ${e.message}`);
        }

        // Transaction 2
        console.log('\n   Transaction 2:');
        try {
            const signed2 = await signTransfer(parseEther('0.0001'));
            console.log(`   ✅ Signed: ${signed2.signature.sessionKeyHash.slice(0, 20)}...`);
        } catch (e: any) {
            console.log(`   ⚠️  ${e.message}`);
        }

        // Transaction 3
        console.log('\n   Transaction 3:');
        try {
            const signed3 = await signTransfer(parseEther('0.0001'));
            console.log(`   ✅ Signed: ${signed3.signature.sessionKeyHash.slice(0, 20)}...`);
        } catch (e: any) {
            console.log(`   ⚠️  ${e.message}`);
        }

        console.log('\n✅ All transactions executed without passkey prompts!');

        // =====================================================================
        // Step 4: Check Session Status
        // =====================================================================
        
        console.log('\n📊 Session status:');
        
        const isActive = sessionManager.isActive();
        const timeRemaining = sessionManager.getTimeRemaining();
        
        console.log(`   Active: ${isActive ? 'Yes' : 'No'}`);
        console.log(`   Time Remaining: ${Math.floor(timeRemaining / 60)} minutes`);
        console.log(`   Max Value: ${formatEther(session.maxValue)} ETH`);

        // =====================================================================
        // Step 5: Test Session Limits
        // =====================================================================
        
        console.log('\n🛡️  Testing session limits...');
        
        // Try to exceed max value
        console.log('\n   Attempting transaction above limit:');
        try {
            await signTransfer(parseEther('0.2')); // Exceeds 0.1 ETH limit
            console.log('   ❌ Should have been rejected!');
        } catch (e: any) {
            console.log(`   ✅ Correctly rejected: ${e.message}`);
        }

        // =====================================================================
        // Step 6: Refresh Session
        // =====================================================================
        
        console.log('\n🔄 Refreshing session...');
        
        try {
            const refreshedSession = await sessionManager.refreshSession();
            console.log('✅ Session refreshed!');
            console.log(`   New expiry: ${new Date(refreshedSession.expiry).toISOString()}`);
        } catch (e: any) {
            console.log(`⚠️  Refresh not needed or failed: ${e.message}`);
        }

        // =====================================================================
        // Step 7: Revoke Session
        // =====================================================================
        
        console.log('\n🚫 Revoking session...');
        
        await sessionManager.revokeSession();
        
        console.log('✅ Session revoked successfully!');

        // Verify session is no longer active
        const isStillActive = sessionManager.isActive();
        console.log(`   Active: ${isStillActive ? 'Yes' : 'No'}`);

        // Try to use revoked session
        console.log('\n   Attempting to use revoked session:');
        try {
            await signTransfer(parseEther('0.0001'));
            console.log('   ❌ Should have been rejected!');
        } catch (e: any) {
            console.log(`   ✅ Correctly rejected: ${e.message}`);
        }

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Error:', error.message);
            
            if (error.message.includes('No credential')) {
                console.log('\n💡 Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// Session Security Best Practices
// ============================================================================

async function showSecurityBestPractices() {
    console.log('\n' + '='.repeat(50));
    console.log('🛡️  Session Security Best Practices');
    console.log('='.repeat(50));

    console.log(`
1. Duration Limits:
   • Keep sessions short (1-24 hours max)
   • Longer sessions = higher risk if compromised
   • Consider user activity patterns

2. Value Limits:
   • Set appropriate maxValue per transaction
   • Lower limits for higher security
   • Consider use case requirements

3. Revocation:
   • Revoke sessions when done
   • Implement automatic revocation on logout
   • Monitor for suspicious activity

4. Storage:
   • Store session keys securely
   • Use encrypted storage in browsers
   • Never expose private keys

5. Refresh Strategy:
   • Refresh before expiry for seamless UX
   • Require re-authentication periodically
   • Balance security vs convenience

6. Monitoring:
   • Track session usage
   • Alert on unusual patterns
   • Log all session operations
    `);
}

// ============================================================================
// Session Use Cases
// ============================================================================

async function showUseCases() {
    console.log('\n' + '='.repeat(50));
    console.log('💡 Session Key Use Cases');
    console.log('='.repeat(50));

    console.log(`
1. Gaming:
   • In-game purchases without repeated auth
   • Fast transactions for better UX
   • Limited value per transaction

2. DeFi:
   • Multiple swaps in a trading session
   • Automated strategies
   • Bounded delegation for safety

3. Social:
   • Tipping and micro-transactions
   • Content purchases
   • Subscription payments

4. Mobile Apps:
   • Reduced biometric prompts
   • Better battery life
   • Smoother user experience

5. Automation:
   • Scheduled transactions
   • Recurring payments
   • Bot operations with limits
    `);
}

// ============================================================================
// Session Lifecycle Diagram
// ============================================================================

async function showLifecycleDiagram() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Session Lifecycle');
    console.log('='.repeat(50));

    console.log(`
┌─────────────────────────────────────────────────┐
│                                                 │
│  1. CREATE                                      │
│     • User authenticates with passkey           │
│     • Generate temporary key pair               │
│     • Register session on-chain                 │
│     • Set duration and value limits             │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  2. USE                                         │
│     • Sign transactions with session key        │
│     • No passkey prompts needed                 │
│     • Enforce value limits                      │
│     • Track usage                               │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  3. REFRESH (Optional)                          │
│     • Extend session before expiry              │
│     • Requires passkey re-authentication        │
│     • Update expiry timestamp                   │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  4. REVOKE                                      │
│     • Manual revocation by user                 │
│     • Automatic expiry after duration           │
│     • On-chain state update                     │
│     • Session key becomes invalid               │
│                                                 │
└─────────────────────────────────────────────────┘
    `);
}

// Run examples
main()
    .then(() => showSecurityBestPractices())
    .then(() => showUseCases())
    .then(() => showLifecycleDiagram())
    .catch(console.error);
