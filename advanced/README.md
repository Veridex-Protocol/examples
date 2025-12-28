# Advanced Examples

This folder contains security-first, production-oriented examples that focus on *verification* and *defensive handling* of cross-chain inputs.

These scripts are intentionally designed to run in Node.js without requiring a browser WebAuthn environment.

## What’s here

- `01-vaa-verify.ts`
  - Validates a Wormhole VAA as hostile input.
  - Enforces quorum (13/19 on mainnet, 1/1 on testnet).
  - Optionally enforces expected emitter chain + emitter address.
  - Attempts to decode the payload as a Veridex payload (best-effort).

- `02-vaa-fetch-and-verify.ts`
  - Fetches a VAA from Wormhole APIs by either:
    - `(emitterChain, emitterAddress, sequence)` or
    - `txHash` (operations API with fallback)
  - Runs the same validation checks as `01-vaa-verify.ts`.

- `03-session-lifecycle.ts`
  - Demonstrates session key generation, signing, and verification.
  - Uses SDK crypto helpers (`generateSecp256k1KeyPair`, `signWithSessionKey`, etc.).
  - Does NOT call the on-chain registration path; purely off-chain lifecycle.

## Running

From `examples/`:

- Verify an already-obtained base64 VAA:

```bash
VAA_BASE64="..." npx ts-node advanced/01-vaa-verify.ts --mainnet \
  --expected-emitter-chain 30 \
  --expected-emitter-address 0x0000000000000000000000000000000000000000
```

- Fetch then verify by `(emitterChain, emitterAddress, sequence)`:

```bash
npx ts-node advanced/02-vaa-fetch-and-verify.ts \
  --testnet \
  --emitter-chain 10004 \
  --emitter-address 0x0000000000000000000000000000000000000000 \
  --sequence 1
```

- Fetch then verify by tx hash (testnet/mainnet inferred by flag):

```bash
npx ts-node advanced/02-vaa-fetch-and-verify.ts --mainnet --tx-hash 0x...
```
- Session key lifecycle:

```bash
bun run advanced/03-session-lifecycle.ts
```
## Notes and security assumptions

- These examples verify *structural* and *policy* properties (quorum, emitter identity).
- On-chain signature verification still happens in Wormhole core contracts; do not treat off-chain checks as a substitute for on-chain verification.
- Always enforce single-execution on destination chains by persisting `(emitterChain, emitterAddress, sequence)` or the VAA body hash.
