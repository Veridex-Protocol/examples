/**
 * Advanced Example 01: Wormhole VAA Verification (defensive)
 *
 * Goals:
 * - Treat VAAs as hostile input.
 * - Enforce guardian quorum.
 * - Optionally enforce expected emitter chain + emitter address.
 * - Best-effort decode of the Veridex payload.
 *
 * Run:
 *   VAA_BASE64="..." bun run advanced/01-vaa-verify.ts --testnet
 *
 * Optional flags:
 *   --vaa-base64 <base64>
 *   --vaa-file <path>
 *   --testnet | --mainnet
 *   --expected-emitter-chain <number>
 *   --expected-emitter-address <0x...>
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import {
    hasQuorum,
    parseVAA,
    parseVeridexPayload,
    validateEmitter,
} from '@veridex/sdk';

type CliArgs = Record<string, string | boolean>;

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {};
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('--')) continue;

        const key = token.slice(2);
        const next = argv[i + 1];
        const hasValue = next && !next.startsWith('--');

        if (hasValue) {
            args[key] = next;
            i++;
        } else {
            args[key] = true;
        }
    }
    return args;
}

function requireString(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Missing or invalid ${label}`);
    }
    return value.trim();
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return defaultValue;
    const value = raw.trim().toLowerCase();
    if (value === '1' || value === 'true' || value === 'yes') return true;
    if (value === '0' || value === 'false' || value === 'no') return false;
    throw new Error(`Invalid boolean in env ${name}: ${raw}`);
}

function normalizeHex(input: string, label: string): string {
    const value = input.trim();
    if (!/^0x[0-9a-fA-F]*$/.test(value)) {
        throw new Error(`Invalid hex for ${label}`);
    }
    if (value.length % 2 !== 0) {
        throw new Error(`Invalid hex length for ${label}`);
    }
    return value;
}

function loadVaaBase64(args: CliArgs): string {
    const fromFlag = typeof args['vaa-base64'] === 'string' ? String(args['vaa-base64']) : undefined;
    const fromEnv = process.env.VAA_BASE64;

    if (fromFlag) return fromFlag.trim();
    if (fromEnv) return fromEnv.trim();

    const vaaFile = typeof args['vaa-file'] === 'string' ? String(args['vaa-file']) : process.env.VAA_FILE;
    if (vaaFile) {
        const content = readFileSync(vaaFile, 'utf8');
        return content.trim();
    }

    throw new Error('Provide VAA via --vaa-base64, VAA_BASE64, --vaa-file, or VAA_FILE');
}

function assertUniqueGuardianIndexes(indexes: number[]): void {
    const seen = new Set<number>();
    for (const idx of indexes) {
        if (seen.has(idx)) {
            throw new Error(`Invalid VAA: duplicate guardian index ${idx}`);
        }
        seen.add(idx);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const testnetFlag = Boolean(args.testnet);
    const mainnetFlag = Boolean(args.mainnet);
    if (testnetFlag && mainnetFlag) {
        throw new Error('Choose exactly one: --testnet or --mainnet');
    }

    const testnet = testnetFlag ? true : mainnetFlag ? false : parseBooleanEnv('TESTNET', true);

    const expectedEmitterChainRaw =
        typeof args['expected-emitter-chain'] === 'string'
            ? String(args['expected-emitter-chain'])
            : process.env.EXPECTED_EMITTER_CHAIN;

    const expectedEmitterAddressRaw =
        typeof args['expected-emitter-address'] === 'string'
            ? String(args['expected-emitter-address'])
            : process.env.EXPECTED_EMITTER_ADDRESS;

    const vaaBase64 = loadVaaBase64(args).replace(/\s+/g, '');

    // Basic sanity check to avoid accidentally accepting empty/garbage input.
    // This is not a cryptographic verification.
    const decoded = Buffer.from(vaaBase64, 'base64');
    if (decoded.length < 50) {
        throw new Error(`VAA too short: ${decoded.length} bytes`);
    }

    const vaa = parseVAA(vaaBase64);

    assertUniqueGuardianIndexes(vaa.signatures.map((s) => s.guardianIndex));

    if (vaa.version !== 1) {
        throw new Error(`Unsupported VAA version: ${vaa.version}`);
    }

    const quorumOk = hasQuorum(vaa, testnet);
    if (!quorumOk) {
        const required = testnet ? 1 : 13;
        throw new Error(`Insufficient guardian signatures: got ${vaa.signatures.length}, require >= ${required}`);
    }

    if (expectedEmitterChainRaw && expectedEmitterAddressRaw) {
        const expectedChain = Number(requireString(expectedEmitterChainRaw, 'expected emitter chain'));
        if (!Number.isInteger(expectedChain) || expectedChain <= 0 || expectedChain > 65535) {
            throw new Error('expected-emitter-chain must be a valid uint16');
        }

        const expectedAddress = normalizeHex(requireString(expectedEmitterAddressRaw, 'expected emitter address'), 'expected emitter address');
        if (!validateEmitter(vaa, expectedChain, expectedAddress)) {
            throw new Error('Emitter mismatch: VAA emitterChain/emitterAddress did not match expected values');
        }
    }

    console.log('SECURITY Wormhole VAA verification checks passed');
    console.log(`- network: ${testnet ? 'testnet' : 'mainnet'}`);
    console.log(`- version: ${vaa.version}`);
    console.log(`- guardianSetIndex: ${vaa.guardianSetIndex}`);
    console.log(`- signatures: ${vaa.signatures.length}`);
    console.log(`- emitterChain: ${vaa.emitterChain}`);
    console.log(`- emitterAddress: ${vaa.emitterAddress}`);
    console.log(`- sequence: ${vaa.sequence.toString()}`);
    console.log(`- nonce: ${vaa.nonce}`);
    console.log(`- timestamp: ${vaa.timestamp}`);
    console.log(`- consistencyLevel: ${vaa.consistencyLevel}`);
    console.log(`- bodyHash: ${vaa.hash}`);
    console.log(`- payloadBytes: ${(vaa.payload.length - 2) / 2}`);

    try {
        const parsed = parseVeridexPayload(vaa.payload);
        console.log('OK Parsed Veridex payload');
        console.log(parsed);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log('NOTE Payload is not a Veridex payload (or failed to parse)');
        console.log(`- reason: ${msg}`);
        console.log(`- payloadPrefix: ${vaa.payload.slice(0, 66)}...`);
    }
}

main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ERROR ${msg}`);
    process.exitCode = 1;
});
