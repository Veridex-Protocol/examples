/**
 * Session Example 01: Create Session
 * 
 * This example demonstrates how to create a session key for
 * temporary delegated access without repeated passkey prompts.
 * 
 * Run: npm run session:create
 */

import { createSDK, SessionManager, EVMHubClientAdapter } from '@veridex/sdk';
import { parseEther, formatEther } from 'ethers';

async function main() {
    console.log('🔑 Create Session Key Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\n📡 SDK initialized for Base testnet');
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`📍 Vault address: ${vaultAddress}`);

        // =====================================================================
        // Step 2: Create Session Manager
        // =====================================================================
        
        console.log('\n🔧 Setting up session manager...');
        
        const hubClient = new EVMHubClientAdapter(sdk.getChainClient());
        const sessionManager = new SessionManager({
            hubClient,
            passkeyManager: sdk.passkey,
        });

        console.log('✅ Session manager ready');

        // =====================================================================
        // Step 3: Create Session with Custom Parameters
        // =====================================================================
        
        console.log('\n🔐 Creating session key...');
        console.log('   (This will trigger passkey authentication)');

        const session = await sessionManager.createSession({
            duration: 3600, // 1 hour
            maxValue: parseEther('0.1'), // Max 0.1 ETH per transaction
            requireUV: true, // Require user verification
        });

        console.log('\n✅ Session created successfully!');
        console.log('\n📋 Session Details:');
        console.log(`   Session Key Hash: ${session.sessionKeyHash}`);
        console.log(`   Created: ${new Date().toISOString()}`);
        console.log(`   Expires: ${new Date(session.expiry * 1000).toISOString()}`);
        console.log(`   Duration: ${Math.floor((session.expiry - Date.now() / 1000) / 60)} minutes`);
        console.log(`   Max Value: ${formatEther(session.maxValue)} ETH`);
        console.log(`   Active: ${session.active ? 'Yes ✅' : 'No ❌'}`);

        // =====================================================================
        // Step 4: Verify Session is Active
        // =====================================================================
        
        console.log('\n🔍 Verifying session status...');
        
        const isActive = await sessionManager.isSessionActive(session);
        console.log(`   Session is ${isActive ? 'active ✅' : 'inactive ❌'}`);

        // =====================================================================
        // Step 5: Save Session for Later Use
        // =====================================================================
        
        console.log('\n💾 Session storage:');
        console.log('   Session keys are automatically stored in browser storage');
        console.log('   You can retrieve them later with sessionManager.getSessions()');

        // Get all active sessions
        const sessions = await sessionManager.getSessions();
        console.log(`   Total active sessions: ${sessions.length}`);

        // =====================================================================
        // Step 6: Display Usage Instructions
        // =====================================================================
        
        console.log('\n' + '='.repeat(50));
        console.log('🚀 Next Steps:');
        console.log('='.repeat(50));
        console.log(`
1. Use this session to execute transactions without passkey prompts
   See: 02-execute-batch.ts

2. The session will automatically expire after 1 hour

3. You can manually revoke it anytime
   See: 03-revoke-session.ts

4. Create multiple sessions with different limits for different use cases
        `);

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
// Create Sessions with Different Configurations
// ============================================================================

async function createMultipleSessions() {
    console.log('\n' + '='.repeat(50));
    console.log('🔑 Multiple Session Configurations');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const hubClient = new EVMHubClientAdapter(sdk.getChainClient());
    const sessionManager = new SessionManager({
        hubClient,
        passkeyManager: sdk.passkey,
    });

    console.log('\n📝 Creating sessions with different limits...\n');

    // Gaming session - short duration, low value
    console.log('1. Gaming Session:');
    try {
        const gamingSession = await sessionManager.createSession({
            duration: 1800, // 30 minutes
            maxValue: parseEther('0.01'), // 0.01 ETH max
            requireUV: false, // Faster, less secure
        });
        console.log(`   ✅ Created (expires in 30 min, max 0.01 ETH)`);
    } catch (e: any) {
        console.log(`   ⚠️  ${e.message}`);
    }

    // Trading session - medium duration, higher value
    console.log('\n2. Trading Session:');
    try {
        const tradingSession = await sessionManager.createSession({
            duration: 7200, // 2 hours
            maxValue: parseEther('1.0'), // 1 ETH max
            requireUV: true, // More secure
        });
        console.log(`   ✅ Created (expires in 2 hours, max 1 ETH)`);
    } catch (e: any) {
        console.log(`   ⚠️  ${e.message}`);
    }

    // Micro-transactions session - long duration, very low value
    console.log('\n3. Micro-transactions Session:');
    try {
        const microSession = await sessionManager.createSession({
            duration: 86400, // 24 hours
            maxValue: parseEther('0.001'), // 0.001 ETH max
            requireUV: false,
        });
        console.log(`   ✅ Created (expires in 24 hours, max 0.001 ETH)`);
    } catch (e: any) {
        console.log(`   ⚠️  ${e.message}`);
    }
}

// ============================================================================
// Session Configuration Guide
// ============================================================================

async function showConfigurationGuide() {
    console.log('\n' + '='.repeat(50));
    console.log('📚 Session Configuration Guide');
    console.log('='.repeat(50));

    console.log(`
Duration Guidelines:
  • Short (15-30 min): Gaming, quick tasks
  • Medium (1-4 hours): Trading, DeFi operations
  • Long (12-24 hours): Automation, scheduled tasks
  • Maximum: 24 hours (enforced by contract)

Value Limits:
  • Micro (< 0.01 ETH): Tips, small purchases
  • Low (0.01-0.1 ETH): Gaming, social
  • Medium (0.1-1 ETH): Trading, swaps
  • High (> 1 ETH): Large operations
  • Unlimited (0): Not recommended

User Verification:
  • requireUV: true
    - More secure
    - May prompt for biometric
    - Recommended for high-value sessions
  
  • requireUV: false
    - Faster execution
    - No additional prompts
    - Suitable for low-value sessions

Security vs Convenience:
  ┌─────────────────────────────────────┐
  │                                     │
  │  High Security:                     │
  │  • Short duration                   │
  │  • Low value limit                  │
  │  • requireUV: true                  │
  │                                     │
  │  High Convenience:                  │
  │  • Longer duration                  │
  │  • Higher value limit               │
  │  • requireUV: false                 │
  │                                     │
  │  Balance based on your use case!    │
  │                                     │
  └─────────────────────────────────────┘
    `);
}

// Run examples
main()
    .then(() => createMultipleSessions())
    .then(() => showConfigurationGuide())
    .catch(console.error);
