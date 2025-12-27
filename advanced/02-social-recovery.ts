/**
 * Social Recovery Example
 * 
 * This example demonstrates how to implement social recovery
 * for Veridex vaults using trusted guardians.
 * 
 * Use cases:
 * - Lost passkey recovery
 * - Emergency account access
 * - Inheritance planning
 */

import { createSDK } from 'veridex-sdk';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

interface Guardian {
    id: string;
    name: string;
    publicKey: string;
    addedAt: Date;
}

interface RecoveryRequest {
    id: string;
    requester: string;
    newPasskeyId: string;
    guardianApprovals: Set<string>;
    createdAt: Date;
    expiresAt: Date;
    status: 'pending' | 'approved' | 'executed' | 'expired' | 'cancelled';
}

interface RecoveryConfig {
    threshold: number;      // Minimum guardian approvals
    delayPeriod: number;    // Seconds before execution (allows owner to cancel)
    expiryPeriod: number;   // Seconds before request expires
}

class SocialRecoveryManager {
    private sdk: ReturnType<typeof createSDK>;
    private guardians: Map<string, Guardian> = new Map();
    private recoveryRequests: Map<string, RecoveryRequest> = new Map();
    private config: RecoveryConfig;
    private vaultAddress: string;

    constructor(chain: string, vaultAddress: string, config: RecoveryConfig) {
        this.sdk = createSDK(chain);
        this.vaultAddress = vaultAddress;
        this.config = config;
    }

    /**
     * Add a trusted guardian
     */
    async addGuardian(name: string, publicKey: string): Promise<string> {
        const guardianId = ethers.id(`guardian:${publicKey}`).slice(0, 18);
        
        const guardian: Guardian = {
            id: guardianId,
            name,
            publicKey,
            addedAt: new Date(),
        };

        this.guardians.set(guardianId, guardian);

        console.log(`✅ Guardian added: ${name}`);
        console.log(`   ID: ${guardianId}`);
        console.log(`   Public Key: ${publicKey.slice(0, 20)}...`);

        return guardianId;
    }

    /**
     * Remove a guardian
     */
    async removeGuardian(guardianId: string): Promise<void> {
        const guardian = this.guardians.get(guardianId);
        if (!guardian) {
            throw new Error('Guardian not found');
        }

        this.guardians.delete(guardianId);
        console.log(`❌ Guardian removed: ${guardian.name}`);
    }

    /**
     * Initiate recovery process
     */
    async initiateRecovery(
        requesterContact: string,
        newPasskeyId: string
    ): Promise<string> {
        const requestId = ethers.id(
            `recovery:${this.vaultAddress}:${Date.now()}`
        ).slice(0, 18);

        const now = new Date();
        const request: RecoveryRequest = {
            id: requestId,
            requester: requesterContact,
            newPasskeyId,
            guardianApprovals: new Set(),
            createdAt: now,
            expiresAt: new Date(now.getTime() + this.config.expiryPeriod * 1000),
            status: 'pending',
        };

        this.recoveryRequests.set(requestId, request);

        console.log(`\n🔄 Recovery initiated: ${requestId}`);
        console.log(`   Vault: ${this.vaultAddress}`);
        console.log(`   Required approvals: ${this.config.threshold}/${this.guardians.size}`);
        console.log(`   Expires: ${request.expiresAt.toISOString()}`);

        // In production, notify all guardians
        this.notifyGuardians(request);

        return requestId;
    }

    /**
     * Guardian approves recovery
     */
    async approveRecovery(
        requestId: string,
        guardianId: string,
        signature: string
    ): Promise<boolean> {
        const request = this.recoveryRequests.get(requestId);
        if (!request) {
            throw new Error('Recovery request not found');
        }

        if (request.status !== 'pending') {
            throw new Error(`Request is ${request.status}`);
        }

        if (new Date() > request.expiresAt) {
            request.status = 'expired';
            throw new Error('Recovery request has expired');
        }

        const guardian = this.guardians.get(guardianId);
        if (!guardian) {
            throw new Error('Guardian not found');
        }

        // Verify signature (simplified)
        if (!this.verifyGuardianSignature(guardian, requestId, signature)) {
            throw new Error('Invalid signature');
        }

        request.guardianApprovals.add(guardianId);

        console.log(`✅ Guardian ${guardian.name} approved recovery`);
        console.log(`   Approvals: ${request.guardianApprovals.size}/${this.config.threshold}`);

        if (request.guardianApprovals.size >= this.config.threshold) {
            request.status = 'approved';
            console.log('\n🔓 Recovery threshold met!');
            console.log(`   Delay period: ${this.config.delayPeriod} seconds`);
            console.log('   Owner can cancel during this time.');
        }

        return request.status === 'approved';
    }

    /**
     * Execute approved recovery after delay
     */
    async executeRecovery(requestId: string): Promise<string> {
        const request = this.recoveryRequests.get(requestId);
        if (!request) {
            throw new Error('Recovery request not found');
        }

        if (request.status !== 'approved') {
            throw new Error(`Request must be approved, current status: ${request.status}`);
        }

        // Check delay period
        const elapsed = (Date.now() - request.createdAt.getTime()) / 1000;
        if (elapsed < this.config.delayPeriod) {
            const remaining = this.config.delayPeriod - elapsed;
            throw new Error(`Delay period not elapsed. ${remaining.toFixed(0)}s remaining.`);
        }

        console.log(`\n🚀 Executing recovery...`);
        console.log(`   Replacing vault access with new passkey: ${request.newPasskeyId}`);

        // In production, this would:
        // 1. Call the vault's recovery function
        // 2. Register the new passkey
        // 3. Invalidate old passkeys

        const txHash = ethers.id(`recovery:executed:${requestId}:${Date.now()}`);

        request.status = 'executed';

        console.log(`✅ Recovery complete!`);
        console.log(`   Transaction: ${txHash}`);

        return txHash;
    }

    /**
     * Owner cancels recovery (during delay period)
     */
    async cancelRecovery(requestId: string, ownerSignature: string): Promise<void> {
        const request = this.recoveryRequests.get(requestId);
        if (!request) {
            throw new Error('Recovery request not found');
        }

        if (request.status === 'executed') {
            throw new Error('Cannot cancel executed recovery');
        }

        // Verify owner signature (in production)
        
        request.status = 'cancelled';
        console.log(`❌ Recovery ${requestId} cancelled by owner`);
    }

    /**
     * Get active guardians
     */
    getGuardians(): Guardian[] {
        return Array.from(this.guardians.values());
    }

    /**
     * Get pending recovery requests
     */
    getPendingRecoveries(): RecoveryRequest[] {
        return Array.from(this.recoveryRequests.values()).filter(
            r => r.status === 'pending' || r.status === 'approved'
        );
    }

    private verifyGuardianSignature(
        guardian: Guardian,
        requestId: string,
        signature: string
    ): boolean {
        // In production, verify WebAuthn signature
        return signature.length > 0;
    }

    private notifyGuardians(request: RecoveryRequest): void {
        console.log('\n📧 Notifying guardians...');
        for (const guardian of this.guardians.values()) {
            console.log(`   → ${guardian.name} (via their registered contact)`);
        }
    }
}

async function main() {
    console.log('🔐 Veridex Social Recovery Example\n');
    console.log('='.repeat(50));

    // Setup recovery with 2-of-3 guardians
    const config: RecoveryConfig = {
        threshold: 2,
        delayPeriod: 86400 * 2, // 2 days in production
        expiryPeriod: 86400 * 7, // 7 days
    };

    const vaultAddress = '0x' + '1234'.repeat(10);

    const recovery = new SocialRecoveryManager('base-sepolia', vaultAddress, {
        ...config,
        delayPeriod: 0, // Disable delay for demo
    });

    // =========================================================================
    // Step 1: Setup Guardians (done when setting up account)
    // =========================================================================
    
    console.log('\n📋 Step 1: Setting Up Guardians\n');

    await recovery.addGuardian('Alice (Sister)', '0x' + 'aaa'.repeat(21) + 'a');
    await recovery.addGuardian('Bob (Best Friend)', '0x' + 'bbb'.repeat(21) + 'b');
    await recovery.addGuardian('Charlie (Lawyer)', '0x' + 'ccc'.repeat(21) + 'c');

    console.log('\n📋 Current guardians:', recovery.getGuardians().length);

    // =========================================================================
    // Step 2: Simulate Lost Passkey - Initiate Recovery
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 Step 2: Lost Passkey - Initiating Recovery\n');

    const newPasskeyId = 'new-passkey-' + Date.now();
    const requestId = await recovery.initiateRecovery(
        'user@email.com',
        newPasskeyId
    );

    // =========================================================================
    // Step 3: Guardians Approve (out of band - they receive notification)
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 Step 3: Guardian Approvals\n');

    const guardians = recovery.getGuardians();

    // First guardian approves
    await recovery.approveRecovery(
        requestId,
        guardians[0].id,
        'guardian_signature_1'
    );

    // Second guardian approves
    const isReady = await recovery.approveRecovery(
        requestId,
        guardians[1].id,
        'guardian_signature_2'
    );

    // =========================================================================
    // Step 4: Execute Recovery (after delay period)
    // =========================================================================
    
    if (isReady) {
        console.log('\n' + '='.repeat(50));
        console.log('📋 Step 4: Executing Recovery\n');

        const txHash = await recovery.executeRecovery(requestId);
        console.log(`\n🎉 Recovery successful! New passkey active.`);
    }

    // =========================================================================
    // Best Practices
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('📚 Social Recovery Best Practices');
    console.log('='.repeat(50));

    console.log(`
    1. Choose guardians carefully:
       - Trusted family/friends who won't collude
       - Mix of tech-savvy and non-tech people
       - Geographically distributed
    
    2. Guardian selection criteria:
       - Long-term relationship
       - Easy to contact in emergency
       - Understands responsibility
       - Uses secure devices
    
    3. Security recommendations:
       - Use at least 3 guardians
       - Set threshold to majority (e.g., 2-of-3, 3-of-5)
       - Set adequate delay period (24-72 hours)
       - Notify owner of any recovery attempt
    
    4. Regular maintenance:
       - Update guardian list if relationships change
       - Periodically verify guardian contact info
       - Test recovery process annually
    
    5. Integration with Veridex:
       
       // Add guardians to your vault
       const sdk = createSDK('base');
       
       await sdk.addRecoveryGuardian({
         name: 'Alice',
         publicKey: alicePasskey.publicKey,
         contactHint: 'alice@encrypted.email',
       });
       
       // On recovery initiation
       await sdk.initiateRecovery({
         newPasskeyId: 'replacement-passkey',
         reason: 'Lost device',
       });
       
       // Guardians approve via their own devices
       // After delay, new passkey is activated
    `);

    console.log('\n✅ Social recovery example complete!');
}

main().catch(console.error);
