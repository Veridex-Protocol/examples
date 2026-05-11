/**
 * Session Example 03: Revoke Session
 * 
 * This example demonstrates how to revoke session keys to
 * prevent further use and maintain security.
 * 
 * Run: npm run session:revoke
 */

import { createSDK, SessionManager, EVMHubClientAdapter } from '@veridex/sdk';
import { parseEther, formatEther, Wallet, JsonRpcProvider, getBytes } from 'ethers';

if (!process.env.PRIVATE_KEY) {
  console.error('✖ PRIVATE_KEY is not set. Export it before running this example.');
  process.exit(1);
}
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
    console.log('🚫 Revoke Session Key Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK and Session Manager
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\n📡 SDK initialized for Base testnet');
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`📍 Vault address: ${vaultAddress}`);

        const credential = sdk.getCredential();
        if (!credential) {
            throw new Error('No credential set. Run 01-create-wallet.ts first.');
        }

        const provider = new JsonRpcProvider('https://sepolia.base.org');
        const signer = new Wallet(PRIVATE_KEY, provider);
        const hubClient = new EVMHubClientAdapter(sdk.getChainClient() as any, signer as any);
        const sessionManager = new SessionManager(
            credential,
            hubClient,
            (challenge) => sdk.passkey.sign(challenge),
            { duration: 3600, maxValue: parseEther('0.1') },
        );

        // =====================================================================
        // Step 2: Check Active Session
        // =====================================================================
        
        console.log('\n📋 Checking for active session...');
        
        const session = await sessionManager.loadSession();
        
        if (!session) {
            console.log('   No active session found.');
            console.log('\n💡 Run sessions/01-create-session.ts first to create a session.');
            return;
        }

        const timeRemaining = sessionManager.getTimeRemaining();
        const minutesRemaining = Math.floor(timeRemaining / 60);
        
        console.log(`\n   Session ${session.keyHash.slice(0, 10)}...`);
        console.log(`      Expires: ${new Date(session.expiry).toISOString()}`);
        console.log(`      Time Remaining: ${minutesRemaining} minutes`);
        console.log(`      Max Value: ${formatEther(session.maxValue)} ETH`);
        console.log(`      Active: ${sessionManager.isActive() ? 'Yes ✅' : 'No ❌'}`);

        // =====================================================================
        // Step 3: Revoke Session
        // =====================================================================
        
        console.log('\n🚫 Revoking session...');
        console.log(`   Session: ${session.keyHash.slice(0, 20)}...`);
        console.log('   (This requires passkey authentication)\n');

        await sessionManager.revokeSession();

        console.log('✅ Session revoked successfully!');

        // =====================================================================
        // Step 4: Verify Session is Revoked
        // =====================================================================
        
        console.log('\n🔍 Verifying revocation...');
        
        const isStillActive = sessionManager.isActive();
        console.log(`   Session is ${isStillActive ? 'still active ❌' : 'revoked ✅'}`);

        // =====================================================================
        // Step 5: Attempt to Use Revoked Session
        // =====================================================================
        
        console.log('\n🧪 Testing revoked session...');
        console.log('   Attempting to sign with revoked session...');

        try {
            const chainConfig = sdk.getChainConfig();
            const actionPayload = await sdk.buildTransferPayload({
                targetChain: chainConfig.wormholeChainId,
                token: 'native',
                recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7',
                amount: parseEther('0.0001'),
            });
            await sessionManager.signAction({
                action: 'transfer',
                targetChain: chainConfig.wormholeChainId,
                payload: getBytes(actionPayload),
                nonce: Number(await sdk.getNonce()),
                value: parseEther('0.0001'),
            });
            console.log('   ❌ Transaction should have been rejected!');
        } catch (error: any) {
            console.log(`   ✅ Transaction correctly rejected: ${error.message}`);
        }

        // =====================================================================
        // Step 6: Verify No Active Session
        // =====================================================================
        
        console.log('\n📋 Session status after revocation:');
        
        const currentSession = sessionManager.getSession();
        console.log(`   Active session: ${currentSession ? 'yes' : 'none ✅'}`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Error:', error.message);
            
            if (error.message.includes('No credential')) {
                console.log('\n💡 Run basic/01-create-wallet.ts first to register a passkey.');
            } else if (error.message.includes('cancelled')) {
                console.log('\n💡 User cancelled the passkey authentication.');
            }
        }
    }
}

// ============================================================================
// Revoke All Sessions
// ============================================================================

async function revokeAllSessions() {
    console.log('\n' + '='.repeat(50));
    console.log('🚫 Revoke All Sessions');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const credential = sdk.getCredential();
    if (!credential) {
        console.log('   ⚠️  No credential set.');
        return;
    }

    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    const hubClient = new EVMHubClientAdapter(sdk.getChainClient() as any, signer as any);
    const sessionManager = new SessionManager(
        credential,
        hubClient,
        (challenge) => sdk.passkey.sign(challenge),
        { duration: 3600, maxValue: parseEther('0.1') },
    );

    try {
        console.log('\n📋 Checking for active session...');
        
        const session = await sessionManager.loadSession();
        
        if (!session) {
            console.log('   No active session to revoke.');
            return;
        }

        console.log(`   Found session: ${session.keyHash.slice(0, 10)}...`);
        console.log('   Revoking...');

        try {
            await sessionManager.revokeSession();
            console.log(`   ✅ Revoked ${session.keyHash.slice(0, 10)}...`);
        } catch (error: any) {
            console.log(`   ❌ Failed: ${error.message}`);
        }

        console.log('\n✅ Session revoked!');

    } catch (error) {
        console.log('   ⚠️  Skipped (no credential registered)');
    }
}

// ============================================================================
// Automatic Revocation Strategies
// ============================================================================

async function showRevocationStrategies() {
    console.log('\n' + '='.repeat(50));
    console.log('🛡️  Revocation Strategies');
    console.log('='.repeat(50));

    console.log(`
When to Revoke Sessions:

1. Manual Revocation:
   • User explicitly logs out
   • User requests session termination
   • Security concern detected

2. Automatic Revocation:
   • Session expires (handled by contract)
   • User closes application
   • Inactivity timeout reached
   • Device lock detected

3. Emergency Revocation:
   • Suspicious activity detected
   • Device lost or stolen
   • Security breach suspected
   • Unauthorized access attempt

Implementation Patterns:

1. On Logout:
   \`\`\`typescript
   async function logout() {
     const sessions = await sessionManager.getSessions();
     for (const session of sessions) {
       await sessionManager.revokeSession(session);
     }
     // Clear local storage
     // Redirect to login
   }
   \`\`\`

2. On Window Close:
   \`\`\`typescript
   window.addEventListener('beforeunload', async () => {
     await revokeAllSessions();
   });
   \`\`\`

3. Inactivity Timer:
   \`\`\`typescript
   let inactivityTimer;
   function resetInactivityTimer() {
     clearTimeout(inactivityTimer);
     inactivityTimer = setTimeout(async () => {
       await revokeAllSessions();
     }, 15 * 60 * 1000); // 15 minutes
   }
   \`\`\`

4. Periodic Cleanup:
   \`\`\`typescript
   setInterval(async () => {
     const sessions = await sessionManager.getSessions();
     for (const session of sessions) {
       if (!await sessionManager.isSessionActive(session)) {
         // Remove from local storage
       }
     }
   }, 60000); // Every minute
   \`\`\`

Best Practices:
  • Always revoke sessions on logout
  • Implement inactivity timeout
  • Monitor for suspicious activity
  • Provide manual revocation UI
  • Log all revocation events
  • Clean up local storage
    `);
}

// ============================================================================
// Session Lifecycle Management
// ============================================================================

async function showLifecycleManagement() {
    console.log('\n' + '='.repeat(50));
    console.log('♻️  Session Lifecycle Management');
    console.log('='.repeat(50));

    console.log(`
Complete Session Lifecycle:

┌─────────────────────────────────────────────────┐
│                                                 │
│  CREATE → USE → MONITOR → REVOKE/EXPIRE        │
│                                                 │
└─────────────────────────────────────────────────┘

1. CREATE:
   • User authenticates with passkey
   • Session key generated and registered
   • Stored in local storage
   • Expiry and limits set

2. USE:
   • Execute transactions without passkey
   • Enforce value limits
   • Track usage
   • Monitor for anomalies

3. MONITOR:
   • Check expiry regularly
   • Validate session is still active
   • Track transaction count
   • Watch for suspicious patterns

4. REVOKE/EXPIRE:
   • Manual revocation by user
   • Automatic expiry after duration
   • Emergency revocation if needed
   • Clean up local storage

Session States:

  ACTIVE ──────────────────────────────────> EXPIRED
    │                                           ↑
    │                                           │
    └──────────> REVOKED ──────────────────────┘

Monitoring Checklist:
  □ Check expiry before each use
  □ Validate session is active
  □ Track cumulative value spent
  □ Monitor transaction frequency
  □ Alert on unusual patterns
  □ Refresh before expiry if needed
  □ Revoke on logout or inactivity
    `);
}

// Run examples
main()
    .then(() => revokeAllSessions())
    .then(() => showRevocationStrategies())
    .then(() => showLifecycleManagement())
    .catch(console.error);
