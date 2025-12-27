/**
 * Session Key Revocation Example
 * 
 * This example demonstrates how to revoke session keys when they
 * are no longer needed or may be compromised.
 */

import { createSDK } from 'veridex-sdk';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

interface SessionInfo {
    id: string;
    name: string;
    createdAt: Date;
    expiresAt: Date;
    constraints: {
        allowedContracts: string[];
        maxValue: bigint;
        usageCount: number;
        maxUsage: number;
    };
    status: 'active' | 'revoked' | 'expired';
    lastUsed: Date | null;
}

async function main() {
    console.log('SECURITY Veridex Session Key Revocation Example\n');
    console.log('='.repeat(50));

    const sdk = createSDK('base-sepolia');

    // Simulated session storage
    const sessions: Map<string, SessionInfo> = new Map();

    // =========================================================================
    // Step 1: Create multiple session keys
    // =========================================================================
    
    console.log('\nNOTE Step 1: Creating Session Keys\n');

    // Gaming session - short lived, limited
    const gamingSession: SessionInfo = {
        id: 'session_gaming_' + Date.now(),
        name: 'Gaming Session',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        constraints: {
            allowedContracts: ['0x' + 'game'.repeat(10)],
            maxValue: ethers.parseEther('0.01'),
            usageCount: 0,
            maxUsage: 100,
        },
        status: 'active',
        lastUsed: null,
    };
    sessions.set(gamingSession.id, gamingSession);
    console.log(`   OK Created: ${gamingSession.name} (expires in 4h)`);

    // DeFi session - longer lived
    const defiSession: SessionInfo = {
        id: 'session_defi_' + Date.now(),
        name: 'DeFi Operations',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        constraints: {
            allowedContracts: ['0x' + 'aave'.repeat(10), '0x' + 'comp'.repeat(10)],
            maxValue: ethers.parseEther('5'),
            usageCount: 5,
            maxUsage: 50,
        },
        status: 'active',
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
    };
    sessions.set(defiSession.id, defiSession);
    console.log(`   OK Created: ${defiSession.name} (expires in 7d)`);

    // Old session that should be cleaned up
    const oldSession: SessionInfo = {
        id: 'session_old_' + Date.now(),
        name: 'Legacy App Integration',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), // Already expired
        constraints: {
            allowedContracts: ['0x' + 'old0'.repeat(10)],
            maxValue: ethers.parseEther('1'),
            usageCount: 15,
            maxUsage: 100,
        },
        status: 'expired',
        lastUsed: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    };
    sessions.set(oldSession.id, oldSession);
    console.log(`    Created: ${oldSession.name} (already expired)`);

    // =========================================================================
    // Step 2: List active sessions
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE Step 2: List Active Sessions\n');

    console.log('Session                      Status    Uses     Expires');
    console.log('-'.repeat(60));
    
    for (const session of sessions.values()) {
        const expiresIn = session.expiresAt.getTime() - Date.now();
        const expiresStr = expiresIn > 0 
            ? `${Math.floor(expiresIn / (1000 * 60 * 60))}h`
            : 'expired';
        
        const statusIcon = session.status === 'active' ? 'LOW' : 
                          session.status === 'revoked' ? 'CRITICAL' : '';
        
        console.log(
            `${statusIcon} ${session.name.padEnd(24)} ` +
            `${session.status.padEnd(9)} ` +
            `${session.constraints.usageCount}/${session.constraints.maxUsage}`.padEnd(8) +
            ` ${expiresStr}`
        );
    }

    // =========================================================================
    // Step 3: Revoke a specific session
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE Step 3: Revoke Specific Session\n');

    console.log('Scenario: User finished gaming, wants to revoke gaming session\n');

    const sessionToRevoke = gamingSession;
    
    console.log(`Revoking: ${sessionToRevoke.name}`);
    console.log(`   ID: ${sessionToRevoke.id}`);
    console.log(`   Uses: ${sessionToRevoke.constraints.usageCount}`);

    // In production, this would call the SDK
    // await sdk.revokeSession(sessionToRevoke.id);
    
    sessionToRevoke.status = 'revoked';
    
    console.log(`   OK Session revoked!`);
    console.log(`   Any pending transactions with this session will fail.`);

    // =========================================================================
    // Step 4: Emergency - Revoke all sessions
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE Step 4: Emergency Revoke All\n');

    console.log('Scenario: User suspects compromise, wants to revoke everything\n');

    console.log('WARN  WARNING: This will revoke ALL active session keys!');
    console.log('   Automated systems using these keys will stop working.\n');

    // Simulate confirmation
    const confirmed = true; // In UI, would be user confirmation

    if (confirmed) {
        let revokedCount = 0;
        
        for (const session of sessions.values()) {
            if (session.status === 'active') {
                // In production: await sdk.revokeSession(session.id);
                session.status = 'revoked';
                revokedCount++;
                console.log(`   CRITICAL Revoked: ${session.name}`);
            }
        }

        console.log(`\n   OK Revoked ${revokedCount} active sessions`);
    }

    // =========================================================================
    // Step 5: View revocation history
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE Step 5: Session Status Summary\n');

    const summary = {
        active: 0,
        revoked: 0,
        expired: 0,
    };

    for (const session of sessions.values()) {
        summary[session.status]++;
    }

    console.log(`Active:  ${summary.active}`);
    console.log(`Revoked: ${summary.revoked}`);
    console.log(`Expired: ${summary.expired}`);

    // =========================================================================
    // Best Practices
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('DOCS Session Key Best Practices');
    console.log('='.repeat(50));

    console.log(`
    1. Use appropriate expiry times:
       - Gaming/casual use: 1-4 hours
       - Daily operations: 24 hours
       - Automated systems: 7-30 days with tight constraints
    
    2. Set proper constraints:
       - Limit to specific contracts
       - Set maximum transaction values
       - Use rate limits
       - Restrict to specific methods
    
    3. Regular housekeeping:
       - Revoke sessions after use
       - Review active sessions weekly
       - Set up alerts for unusual activity
    
    4. Emergency procedures:
       - Have a "revoke all" emergency procedure
       - Monitor for suspicious session usage
       - Rotate long-lived sessions periodically
    
    5. Integration code:
       
       // Revoke specific session
       await sdk.revokeSession('session_id');
       
       // Revoke all sessions
       await sdk.revokeAllSessions();
       
       // Revoke sessions by criteria
       await sdk.revokeSessions({
         olderThan: 7 * 24 * 60 * 60, // 7 days
         unused: true,
       });
       
       // Monitor session activity
       sdk.on('sessionUsed', (sessionId, tx) => {
         if (isUnusualActivity(tx)) {
           sdk.revokeSession(sessionId);
           notifyUser('Suspicious activity detected');
         }
       });
    `);

    console.log('\nOK Session revocation example complete!');
}

main().catch(console.error);
