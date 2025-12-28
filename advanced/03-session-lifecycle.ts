/**
 * Advanced Example 03: Session Key Lifecycle
 *
 * Demonstrates production-ready session key workflow:
 * - Generate a new session key pair (secp256k1).
 * - Compute session key hash (used as on-chain identifier).
 * - Sign an action payload with the session key.
 * - Validate the signature matches the public key.
 * - (Optional) Show how to configure storage.
 *
 * Security assumptions:
 * - Session private keys are ephemeral and must be encrypted at rest.
 * - Session keys are bound to user-configured value/time limits.
 * - This script does NOT register sessions on-chain; use the SDK SessionManager for that.
 *
 * Run:
 *   bun run advanced/03-session-lifecycle.ts
 */

import 'dotenv/config';
import {
    generateSecp256k1KeyPair,
    computeSessionKeyHash,
    signWithSessionKey,
    verifySessionSignature,
    hashAction,
    encodeTransferAction,
    validateSessionConfig,
    MAX_SESSION_DURATION,
    MIN_SESSION_DURATION,
} from '@veridex/sdk';

async function main() {
    console.log('SECURITY Session Key Lifecycle Example\n');
    console.log('='.repeat(50));

    // Helper to convert Uint8Array to hex
    const toHex = (bytes: Uint8Array): string => {
        return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    };

    // =========================================================================
    // Step 1: Generate a session key pair
    // =========================================================================

    console.log('\n[1/5] Generating secp256k1 session key pair...');
    const keyPair = generateSecp256k1KeyPair();

    if (!keyPair.privateKey || !keyPair.publicKey) {
        throw new Error('Key pair generation failed');
    }

    const privateKeyHex = toHex(keyPair.privateKey);
    const publicKeyHex = toHex(keyPair.publicKey);

    console.log(`  - privateKey (hex, first 12 chars): ${privateKeyHex.slice(0, 14)}...`);
    console.log(`  - publicKey  (hex, first 20 chars): ${publicKeyHex.slice(0, 22)}...`);
    console.log(`  - address:                          ${keyPair.address}`);

    // =========================================================================
    // Step 2: Compute session key hash
    // =========================================================================

    console.log('\n[2/5] Computing session key hash (on-chain identifier)...');
    const sessionKeyHash = computeSessionKeyHash(keyPair.publicKey);

    if (!sessionKeyHash.startsWith('0x') || sessionKeyHash.length !== 66) {
        throw new Error('Invalid session key hash');
    }

    console.log(`  - sessionKeyHash: ${sessionKeyHash}`);

    // =========================================================================
    // Step 3: Validate session config
    // =========================================================================

    console.log('\n[3/5] Validating sample session configuration...');
    const sessionConfig = {
        duration: 3600,
        maxValue: BigInt('100000000000000000'), // 0.1 ETH
    };

    try {
        validateSessionConfig(sessionConfig);
        console.log('  - duration:  valid');
        console.log('  - maxValue:  valid');
        console.log(`  - min allowed: ${MIN_SESSION_DURATION}s`);
        console.log(`  - max allowed: ${MAX_SESSION_DURATION}s`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Session config validation failed: ${msg}`);
    }

    // =========================================================================
    // Step 4: Sign an action payload with the session key
    // =========================================================================

    console.log('\n[4/5] Signing a sample transfer action with session key...');

    const token = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // mock USDC
    const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f5A234';
    const amount = BigInt('1000000'); // 1 USDC (6 decimals)
    const nonce = 1;

    const actionPayload = encodeTransferAction(token, recipient, amount);

    // hashAction expects { action, targetChain, value, payload, nonce, deadline? }
    const actionHash = hashAction({
        action: 'transfer',
        targetChain: 10004, // Base Sepolia
        value: BigInt(0),
        payload: new Uint8Array(Buffer.from(actionPayload.slice(2), 'hex')),
        nonce,
    });
    const { signature, r, s, v } = signWithSessionKey(keyPair.privateKey, actionHash);

    console.log(`  - actionPayload (bytes): ${(actionPayload.length - 2) / 2}`);
    console.log(`  - actionHash:            ${toHex(actionHash)}`);
    console.log(`  - r (first 20):          ${r.slice(0, 22)}...`);
    console.log(`  - s (first 20):          ${s.slice(0, 22)}...`);
    console.log(`  - v:                     ${v}`);

    // =========================================================================
    // Step 5: Verify the signature
    // =========================================================================

    console.log('\n[5/5] Verifying session signature...');

    const verified = verifySessionSignature(actionHash, signature, keyPair.publicKey);

    if (!verified) {
        throw new Error('Signature verification failed');
    }

    console.log('  - verification: PASS');

    // =========================================================================
    // Done
    // =========================================================================

    console.log('\n' + '='.repeat(50));
    console.log('OK Session key lifecycle completed without errors.');
    console.log('='.repeat(50));
}

main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ERROR ${msg}`);
    process.exitCode = 1;
});
