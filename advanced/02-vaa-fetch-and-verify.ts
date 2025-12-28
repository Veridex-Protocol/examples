/**
 * Advanced Example 02: Fetch and Verify a Wormhole VAA (defensive)
 *
 * Fetch methods:
 * - By (emitterChain, emitterAddress, sequence)
 * - By tx hash (operations API with fallback)
 *
 * Run:
 *   bun run advanced/02-vaa-fetch-and-verify.ts --testnet \
 *     --emitter-chain 10004 --emitter-address 0x... --sequence 1
 *
 *   bun run advanced/02-vaa-fetch-and-verify.ts --mainnet --tx-hash 0x...
 */

import 'dotenv/config';
import {
    fetchVAA,
    fetchVAAByTxHash,
    fetchVAAByTxHashFallback,
    hasQuorum,
    parseVAA,
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

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return defaultValue;
    const value = raw.trim().toLowerCase();
    if (value === '1' || value === 'true' || value === 'yes') return true;
    if (value === '0' || value === 'false' || value === 'no') return false;
    throw new Error(`Invalid boolean in env ${name}: ${raw}`);
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

async function fetchVaaBase64(args: CliArgs, testnet: boolean): Promise<{ vaaBase64: string; expected?: { chain: number; address: string } }> {
    const txHashRaw = typeof args['tx-hash'] === 'string' ? String(args['tx-hash']) : process.env.TX_HASH;
    if (txHashRaw) {
        const txHash = normalizeHex(txHashRaw, 'tx hash');
        try {
            const vaaBase64 = await fetchVAAByTxHash(txHash, {
                testnet,
                onRetry: (attempt, max) => {
                    console.log(`NOTE retry ${attempt}/${max} waiting for VAA`);
                },
            });
            return { vaaBase64 };
        } catch {
            const vaaBase64 = await fetchVAAByTxHashFallback(txHash, {
                testnet,
                onRetry: (attempt, max) => {
                    console.log(`NOTE retry ${attempt}/${max} waiting for VAA (fallback)`);
                },
            });
            return { vaaBase64 };
        }
    }

    const emitterChainRaw = typeof args['emitter-chain'] === 'string' ? String(args['emitter-chain']) : process.env.EMITTER_CHAIN;
    const emitterAddressRaw = typeof args['emitter-address'] === 'string' ? String(args['emitter-address']) : process.env.EMITTER_ADDRESS;
    const sequenceRaw = typeof args['sequence'] === 'string' ? String(args['sequence']) : process.env.SEQUENCE;

    const emitterChain = Number(requireString(emitterChainRaw, 'emitter chain'));
    if (!Number.isInteger(emitterChain) || emitterChain <= 0 || emitterChain > 65535) {
        throw new Error('emitter-chain must be a valid uint16');
    }

    const emitterAddress = normalizeHex(requireString(emitterAddressRaw, 'emitter address'), 'emitter address');

    const seqStr = requireString(sequenceRaw, 'sequence');
    if (!/^[0-9]+$/.test(seqStr)) {
        throw new Error('sequence must be a base-10 integer');
    }

    const sequence = BigInt(seqStr);

    const vaaBase64 = await fetchVAA(emitterChain, emitterAddress, sequence, {
        testnet,
        onRetry: (attempt, max) => {
            console.log(`NOTE retry ${attempt}/${max} waiting for VAA`);
        },
    });

    return { vaaBase64, expected: { chain: emitterChain, address: emitterAddress } };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const testnetFlag = Boolean(args.testnet);
    const mainnetFlag = Boolean(args.mainnet);
    if (testnetFlag && mainnetFlag) {
        throw new Error('Choose exactly one: --testnet or --mainnet');
    }

    const testnet = testnetFlag ? true : mainnetFlag ? false : parseBooleanEnv('TESTNET', true);

    const { vaaBase64, expected } = await fetchVaaBase64(args, testnet);

    const decoded = Buffer.from(vaaBase64.replace(/\s+/g, ''), 'base64');
    if (decoded.length < 50) {
        throw new Error(`VAA too short: ${decoded.length} bytes`);
    }

    const vaa = parseVAA(vaaBase64);

    assertUniqueGuardianIndexes(vaa.signatures.map((s) => s.guardianIndex));

    const quorumOk = hasQuorum(vaa, testnet);
    if (!quorumOk) {
        const required = testnet ? 1 : 13;
        throw new Error(`Insufficient guardian signatures: got ${vaa.signatures.length}, require >= ${required}`);
    }

    if (expected) {
        if (!validateEmitter(vaa, expected.chain, expected.address)) {
            throw new Error('Emitter mismatch: VAA emitterChain/emitterAddress did not match requested values');
        }
    }

    console.log('OK Fetched and verified VAA');
    console.log(`- network: ${testnet ? 'testnet' : 'mainnet'}`);
    console.log(`- emitterChain: ${vaa.emitterChain}`);
    console.log(`- emitterAddress: ${vaa.emitterAddress}`);
    console.log(`- sequence: ${vaa.sequence.toString()}`);
    console.log(`- bodyHash: ${vaa.hash}`);
}

main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ERROR ${msg}`);
    process.exitCode = 1;
});
