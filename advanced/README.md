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

- `03-internal-copilot.ts`
  - Non-payment internal copilot using governed workspace state.
  - Demonstrates: WorkspaceStateProvider/Adapter, ContextCompiler with retrieval policy, typed memory entries (note/derived_memory), security packs (injection + tool poisoning), workspace mutation proposals, eval regression suite.

- `04-multi-agent-operator.ts`
  - Multi-agent incident response workflow with task routing and approvals.
  - Demonstrates: Orchestrator with dependency-aware DAG, capability-match scheduling, 4-agent team (triage → diagnostics → remediation, triage → comms), shared memory, security packs (injection + handoff safety), structured progress events, eval regression.

- `05-treasury-agent.ts`
  - Treasury management agent with trace binding and bounded payments.
  - Demonstrates: budget ceiling security pack, endpoint allowlist, injection detection, policy evaluation (safe vs malicious proposals), CircuitBreaker for RPC resilience, UnifiedTraceCollector → TraceEnvelope with content + envelope hashing, InMemoryEnvelopeSink, per-transaction limits, eval regression.

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
