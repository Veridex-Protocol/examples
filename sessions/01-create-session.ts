/**
 * Example: Session Key Management
 * 
 * Session keys allow users to authorize a temporary key that can execute
 * transactions without requiring passkey signatures for each action.
 * 
 * This is perfect for:
 * - Gaming: Fast in-game transactions
 * - DeFi: Automated trading strategies
 * - Social: Tipping without friction
 * 
 * Run: npx ts-node sessions/01-create-session.ts
 */

import { createSDK, SessionManager } from 'veridex-sdk';
import { parseEther } from 'ethers';

async function main() {
    console.log('🔑 Veridex Session Key Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Initialize SDK
    // =========================================================================
    
    const sdk = createSDK('base');
    
    console.log('\n📡 SDK initialized');
    console.log(`📍 Vault: ${sdk.getVaultAddress()}`);

    // =========================================================================
    // Step 2: Create Session Manager
    // =========================================================================
    
    console.log('\n🔧 Initializing session manager...');
    
    const sessionManager = new SessionManager({
        sdk,
        storage: 'indexeddb', // Secure storage for session keys
    });

    console.log('✅ Session manager ready');

    // =========================================================================
    // Step 3: Create a Session
    // =========================================================================
    
    console.log('\n🔐 Creating session key...');
    console.log('   (This requires ONE passkey signature)\n');

    try {
        // Create a session with specific constraints
        const session = await sessionManager.createSession({
            // Duration: 1 hour
            duration: 3600,
            
            // Maximum value per transaction
            maxValue: parseEther('0.1'),
            
            // Maximum total value for entire session
            maxTotalValue: parseEther('1.0'),
            
            // Optional: Restrict to specific tokens
            allowedTokens: ['native'], // Only ETH
            
            // Optional: Restrict to specific recipients
            // allowedRecipients: ['0x...'],
            
            // Optional: Restrict to specific actions
            allowedActions: ['transfer'], // No bridging
        });

        console.log('✅ Session created successfully!');
        console.log(`\n📋 Session Details:`);
        console.log(`   Session ID: ${session.id}`);
        console.log(`   Created: ${new Date(session.createdAt).toISOString()}`);
        console.log(`   Expires: ${new Date(session.expiresAt).toISOString()}`);
        console.log(`   Max Value: ${session.maxValue} wei`);
        console.log(`   Max Total: ${session.maxTotalValue} wei`);
        console.log(`   Allowed Tokens: ${session.allowedTokens.join(', ') || 'All'}`);
        console.log(`   Allowed Actions: ${session.allowedActions.join(', ') || 'All'}`);

        // =====================================================================
        // Step 4: Execute Transactions with Session
        // =====================================================================
        
        console.log('\n🚀 Executing transactions with session key...');
        console.log('   (No passkey prompts needed!)\n');

        // Transaction 1
        console.log('   TX 1: Sending 0.001 ETH...');
        const tx1 = await sessionManager.executeWithSession({
            action: 'transfer',
            token: 'native',
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7',
            amount: parseEther('0.001'),
        }, session);
        console.log(`   ✅ TX 1 complete: ${tx1.transactionHash.slice(0, 20)}...`);

        // Transaction 2 (no passkey prompt!)
        console.log('   TX 2: Sending 0.002 ETH...');
        const tx2 = await sessionManager.executeWithSession({
            action: 'transfer',
            token: 'native',
            recipient: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
            amount: parseEther('0.002'),
        }, session);
        console.log(`   ✅ TX 2 complete: ${tx2.transactionHash.slice(0, 20)}...`);

        // Transaction 3 (still no prompt!)
        console.log('   TX 3: Sending 0.001 ETH...');
        const tx3 = await sessionManager.executeWithSession({
            action: 'transfer',
            token: 'native',
            recipient: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
            amount: parseEther('0.001'),
        }, session);
        console.log(`   ✅ TX 3 complete: ${tx3.transactionHash.slice(0, 20)}...`);

        console.log('\n🎉 All transactions executed without additional prompts!');

        // =====================================================================
        // Step 5: Check Session Status
        // =====================================================================
        
        console.log('\n📊 Session Status:');
        const status = await sessionManager.getSessionStatus(session.id);
        console.log(`   Transactions: ${status.transactionCount}`);
        console.log(`   Total Value Spent: ${status.totalValueSpent} wei`);
        console.log(`   Remaining Value: ${status.remainingValue} wei`);
        console.log(`   Time Remaining: ${status.timeRemaining} seconds`);

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Error:', error.message);
            
            if (error.message.includes('exceeds')) {
                console.log('\n💡 Transaction exceeds session limits.');
            } else if (error.message.includes('expired')) {
                console.log('\n💡 Session has expired. Create a new one.');
            }
        }
    }
}

// ============================================================================
// Session Persistence Example
// ============================================================================

async function sessionPersistence() {
    console.log('\n' + '='.repeat(50));
    console.log('💾 Session Persistence');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const sessionManager = new SessionManager({ sdk });

    console.log('\n📋 Managing persisted sessions...\n');

    // List all active sessions
    const sessions = await sessionManager.listSessions();
    console.log(`Found ${sessions.length} active sessions:`);
    
    for (const session of sessions) {
        const remaining = Math.floor((session.expiresAt - Date.now()) / 1000);
        console.log(`   • ${session.id}: expires in ${remaining}s`);
    }

    // Resume a session
    if (sessions.length > 0) {
        console.log('\n🔄 Resuming first session...');
        const resumedSession = await sessionManager.resumeSession(sessions[0].id);
        console.log(`   ✅ Session resumed: ${resumedSession.id}`);
    }

    // Clear expired sessions
    console.log('\n🧹 Cleaning expired sessions...');
    await sessionManager.cleanExpiredSessions();
    console.log('   ✅ Cleanup complete');
}

// ============================================================================
// Session Events Example
// ============================================================================

async function sessionEvents() {
    console.log('\n' + '='.repeat(50));
    console.log('📡 Session Events');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const sessionManager = new SessionManager({ sdk });

    // Subscribe to session events
    sessionManager.on('sessionCreated', (session) => {
        console.log(`   🔑 Session created: ${session.id}`);
    });

    sessionManager.on('transactionExecuted', (tx) => {
        console.log(`   ✅ TX executed: ${tx.hash}`);
    });

    sessionManager.on('sessionExpiring', (session) => {
        console.log(`   ⚠️  Session expiring soon: ${session.id}`);
    });

    sessionManager.on('sessionExpired', (session) => {
        console.log(`   ❌ Session expired: ${session.id}`);
    });

    sessionManager.on('limitReached', (session, limit) => {
        console.log(`   🚫 Limit reached: ${limit} for ${session.id}`);
    });

    console.log('\n📋 Event listeners registered');
    console.log('   Events will fire as sessions are used...\n');
}

// Run examples
main()
    .then(() => sessionPersistence())
    .then(() => sessionEvents())
    .catch(console.error);
