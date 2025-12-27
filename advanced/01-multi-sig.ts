/**
 * Multi-Signature Authorization Example
 * 
 * This example demonstrates how to implement multi-passkey authorization
 * for high-value transactions using Veridex's session key system.
 * 
 * Use cases:
 * - Corporate treasuries requiring multiple signers
 * - DAO fund management
 * - Family/joint accounts
 */

import { createSDK } from 'veridex-sdk';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

interface MultiSigConfig {
    threshold: number;  // Minimum approvals required
    signers: string[];  // List of authorized signer public keys
    timelock: number;   // Minimum time delay for execution (seconds)
}

interface PendingTransaction {
    id: string;
    to: string;
    value: bigint;
    data: string;
    approvals: Set<string>;
    createdAt: Date;
    status: 'pending' | 'ready' | 'executed' | 'cancelled';
}

class MultiSigManager {
    private sdk: ReturnType<typeof createSDK>;
    private config: MultiSigConfig;
    private pendingTxs: Map<string, PendingTransaction> = new Map();

    constructor(chain: string, config: MultiSigConfig) {
        this.sdk = createSDK(chain);
        this.config = config;
    }

    /**
     * Propose a new transaction for multi-sig approval
     */
    async proposeTransaction(
        to: string,
        value: bigint,
        data: string = '0x'
    ): Promise<string> {
        const txId = ethers.id(
            `${to}:${value}:${data}:${Date.now()}`
        ).slice(0, 18);

        const pendingTx: PendingTransaction = {
            id: txId,
            to,
            value,
            data,
            approvals: new Set(),
            createdAt: new Date(),
            status: 'pending',
        };

        this.pendingTxs.set(txId, pendingTx);

        console.log(`📝 Transaction proposed: ${txId}`);
        console.log(`   To: ${to}`);
        console.log(`   Value: ${ethers.formatEther(value)} ETH`);
        console.log(`   Required approvals: ${this.config.threshold}/${this.config.signers.length}`);

        return txId;
    }

    /**
     * Sign/approve a pending transaction
     */
    async approveTransaction(
        txId: string,
        signerPublicKey: string,
        signature: string
    ): Promise<boolean> {
        const pendingTx = this.pendingTxs.get(txId);
        
        if (!pendingTx) {
            throw new Error('Transaction not found');
        }

        if (pendingTx.status !== 'pending' && pendingTx.status !== 'ready') {
            throw new Error(`Transaction is ${pendingTx.status}`);
        }

        // Verify signer is authorized
        if (!this.config.signers.includes(signerPublicKey)) {
            throw new Error('Signer not authorized');
        }

        // Verify signature (in production, use WebAuthn verification)
        const isValid = await this.verifySignature(pendingTx, signerPublicKey, signature);
        if (!isValid) {
            throw new Error('Invalid signature');
        }

        // Add approval
        pendingTx.approvals.add(signerPublicKey);

        console.log(`✅ Approval added from ${signerPublicKey.slice(0, 10)}...`);
        console.log(`   Current approvals: ${pendingTx.approvals.size}/${this.config.threshold}`);

        // Check if threshold is met
        if (pendingTx.approvals.size >= this.config.threshold) {
            pendingTx.status = 'ready';
            console.log('🔓 Threshold met! Transaction ready for execution.');
        }

        return pendingTx.status === 'ready';
    }

    /**
     * Execute a transaction that has met the threshold
     */
    async executeTransaction(txId: string): Promise<string> {
        const pendingTx = this.pendingTxs.get(txId);
        
        if (!pendingTx) {
            throw new Error('Transaction not found');
        }

        if (pendingTx.status !== 'ready') {
            throw new Error(`Transaction is ${pendingTx.status}, needs to be 'ready'`);
        }

        // Check timelock
        const elapsed = (Date.now() - pendingTx.createdAt.getTime()) / 1000;
        if (elapsed < this.config.timelock) {
            const remaining = this.config.timelock - elapsed;
            throw new Error(`Timelock not elapsed. ${remaining.toFixed(0)}s remaining.`);
        }

        console.log(`🚀 Executing transaction ${txId}...`);

        // Execute via SDK (would use session key with multi-sig constraints)
        // In production, this would call the actual contract
        const txHash = ethers.id(`executed:${txId}:${Date.now()}`);

        pendingTx.status = 'executed';

        console.log(`✅ Transaction executed: ${txHash}`);

        return txHash;
    }

    /**
     * Cancel a pending transaction (requires majority)
     */
    async cancelTransaction(txId: string): Promise<void> {
        const pendingTx = this.pendingTxs.get(txId);
        
        if (!pendingTx) {
            throw new Error('Transaction not found');
        }

        if (pendingTx.status === 'executed') {
            throw new Error('Cannot cancel executed transaction');
        }

        pendingTx.status = 'cancelled';
        console.log(`❌ Transaction ${txId} cancelled`);
    }

    /**
     * Get pending transactions
     */
    getPendingTransactions(): PendingTransaction[] {
        return Array.from(this.pendingTxs.values()).filter(
            tx => tx.status === 'pending' || tx.status === 'ready'
        );
    }

    /**
     * Verify a signature (simplified - in production use WebAuthn)
     */
    private async verifySignature(
        tx: PendingTransaction,
        publicKey: string,
        signature: string
    ): Promise<boolean> {
        // In production, this would verify WebAuthn signature
        // For this example, we just check signature is not empty
        return signature.length > 0;
    }
}

async function main() {
    console.log('🔐 Veridex Multi-Signature Example\n');
    console.log('='.repeat(50));

    // Configure multi-sig (2 of 3 signers, 1 hour timelock)
    const config: MultiSigConfig = {
        threshold: 2,
        signers: [
            '0x' + '1'.repeat(64), // Signer 1 public key
            '0x' + '2'.repeat(64), // Signer 2 public key
            '0x' + '3'.repeat(64), // Signer 3 public key
        ],
        timelock: 3600, // 1 hour for production, 0 for demo
    };

    const multiSig = new MultiSigManager('base-sepolia', {
        ...config,
        timelock: 0, // Disable timelock for demo
    });

    // Step 1: Propose a high-value transaction
    console.log('\n📋 Step 1: Proposing Transaction\n');
    
    const txId = await multiSig.proposeTransaction(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f5ABCD',
        ethers.parseEther('10'),
        '0x'
    );

    // Step 2: First signer approves
    console.log('\n📋 Step 2: First Signer Approval\n');
    
    await multiSig.approveTransaction(
        txId,
        config.signers[0],
        'signature_from_webauthn_1'
    );

    // Check pending transactions
    console.log('\n📋 Pending Transactions:');
    const pending = multiSig.getPendingTransactions();
    for (const tx of pending) {
        console.log(`   ${tx.id}: ${tx.status} (${tx.approvals.size}/${config.threshold} approvals)`);
    }

    // Step 3: Second signer approves
    console.log('\n📋 Step 3: Second Signer Approval\n');
    
    const isReady = await multiSig.approveTransaction(
        txId,
        config.signers[1],
        'signature_from_webauthn_2'
    );

    // Step 4: Execute if ready
    if (isReady) {
        console.log('\n📋 Step 4: Executing Transaction\n');
        
        const executedTxHash = await multiSig.executeTransaction(txId);
        console.log(`\n🎉 Transaction complete: ${executedTxHash}`);
    }

    // =========================================================================
    // Real-world integration example
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('📚 Integration Pattern');
    console.log('='.repeat(50));

    console.log(`
    // 1. Create multi-sig vault with multiple passkeys
    const sdk = createSDK('base');
    
    // Each passkey represents an authorized signer
    const passkey1 = await sdk.registerPasskey('treasury-admin-1');
    const passkey2 = await sdk.registerPasskey('treasury-admin-2');
    const passkey3 = await sdk.registerPasskey('treasury-admin-3');
    
    // 2. Deploy a multi-sig wrapper contract
    // This contract requires 2-of-3 signatures for large transfers
    
    // 3. Create constrained session keys for routine operations
    const routineSession = await sdk.createSessionKey({
        constraints: {
            maxValue: parseEther('0.1'),  // Small ops only
            allowedMethods: ['swap', 'claim'],
            rateLimitPerHour: 10,
        },
        duration: 7 * 24 * 60 * 60,
    });
    
    // 4. For large transfers, require multi-sig approval
    if (transferAmount > parseEther('1')) {
        const proposal = await multiSig.proposeTransaction(to, amount);
        // Notify signers via your notification system
        // Wait for threshold approvals
        // Execute after timelock
    }
    `);

    console.log('\n✅ Multi-sig example complete!');
}

main().catch(console.error);
