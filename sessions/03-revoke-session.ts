/**
 * Session Example 03: Revoke Session
 * 
 * This example demonstrates how to revoke session keys to
 * prevent further use and maintain security.
 * 
 * Run: npm run session:revoke
 */

import { createSDK, SessionManager, EVMHubClientAdapter } from '@veridex/sdk';
import { parseEther, formatEther } from 'ethers';

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

        const hubClient = new EVMHubClientAdapter(sdk.getChainClient());
        const sessionManager = new SessionManager({
            hubClient,
            passkeyManager: sdk.passkey,
        });

        // =====================================================================
        // Step 2: List Active Sessions
        // =====================================================================
        
        console.log('\n📋 Listing active sessions...');
        
        const sessions = await sessionManager.getSessions();
        
        if (sessions.length === 0) {
            console.log('   No active sessions found.');
            console.log('\n💡 Run sessions/01-create-session.ts first to create a session.');
            return;
        }

        console.log(`\n   Found ${sessions.length} active session(s):\n`);
        
        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            const timeRemaining = Math.max(0, session.expiry - Math.floor(Date.now() / 1000));
            const minutesRemaining = Math.floor(timeRemaining / 60);
            
            console.log(`   ${i + 1}. Session ${session.sessionKeyHash.slice(0, 10)}...`);
            console.log(`      Expires: ${new Date(session.expiry * 1000).toISOString()}`);
            console.log(`      Time Remaining: ${minutesRemaining} minutes`);
            console.log(`      Max Value: ${formatEther(session.maxValue)} ETH`);
            console.log(`      Active: ${session.active ? 'Yes ✅' : 'No ❌'}`);
            console.log('');
        }

        // =====================================================================
        // Step 3: Revoke First Session
        // =====================================================================
        
        const sessionToRevoke = sessions[0];
        
        console.log('🚫 Revoking session...');
        console.log(`   Session: ${sessionToRevoke.sessionKeyHash.slice(0, 20)}...`);
        console.log('   (This requires passkey authentication)\n');

        await sessionManager.revokeSession(sessionToRevoke);

        console.log('✅ Session revoked successfully!');

        // =====================================================================
        // Step 4: Verify Session is Revoked
        // =====================================================================
        
        console.log('\n🔍 Verifying revocation...');
        
        const isStillActive = await sessionManager.isSessionActive(sessionToRevoke);
        console.log(`   Session is ${isStillActive ? 'still active ❌' : 'revoked ✅'}`);

        // =====================================================================
        // Step 5: Attempt to Use Revoked Session
        // =====================================================================
        
        console.log('\n🧪 Testing revoked session...');
        console.log('   Attempting to execute transaction with revoked session...');

        try {
            const chainConfig = sdk.getChainConfig();
            await sessionManager.executeWithSession(
                {
                    targetChain: chainConfig.wormholeChainId,
                    token: 'native',
                    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7',
                    amount: parseEther('0.0001'),
                },
                sessionToRevoke,
                null as any // No signer needed for this test
            );
            console.log('   ❌ Transaction should have been rejected!');
        } catch (error: any) {
            console.log(`   ✅ Transaction correctly rejected: ${error.message}`);
        }

        // =====================================================================
        // Step 6: List Remaining Sessions
        // =====================================================================
        
        console.log('\n📋 Remaining active sessions:');
        
        const remainingSessions = await sessionManager.getSessions();
        console.log(`   Count: ${remainingSessions.length}`);

        if (remainingSessions.length > 0) {
            console.log('\n💡 Tip: Revoke all sessions when done for maximum security.');
        }

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
    const hubClient = new EVMHubClientAdapter(sdk.getChainClient());
    const sessionManager = new SessionManager({
        hubClient,
        passkeyManager: sdk.passkey,
    });

    try {
        console.log('\n📋 Finding all active sessions...');
        
        const sessions = await sessionManager.getSessions();
        
        if (sessions.length === 0) {
            console.log('   No active sessions to revoke.');
            return;
        }

        console.log(`   Found ${sessions.length} session(s) to revoke\n`);

        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            console.log(`   Revoking session ${i + 1}/${sessions.length}...`);
            
            try {
                await sessionManager.revokeSession(session);
                console.log(`   ✅ Revoked ${session.sessionKeyHash.slice(0, 10)}...`);
            } catch (error: any) {
                console.log(`   ❌ Failed: ${error.message}`);
            }
        }

        console.log('\n✅ All sessions revoked!');

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
