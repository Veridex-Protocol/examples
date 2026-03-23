# Veridex Protocol Examples

Production-ready examples demonstrating how to integrate with the Veridex Protocol — from simple passkey wallets to autonomous AI agents with payments.

> **Full Documentation:** [docs.veridex.network](https://docs.veridex.network) · [veridex-documentation.vercel.app](https://veridex-documentation.vercel.app/)

## Examples at a Glance

| Example | Difficulty | Description | Stack |
|---------|-----------|-------------|-------|
| [react-passkey-demo](#react-passkey-demo) | Beginner | Minimal passkey wallet — register, persist, disconnect | React + Vite |
| [agent-basic](#agent-basic) | Beginner | Passkey wallet + agent provisioning + USDC payments | Next.js 14 |
| [agent-advanced](#agent-advanced) | Advanced | AI chat (Gemini), MCP tools, ERC-8004 identity, trust gates, policy engine, security firewall, 5 payment protocols | Next.js 14 |
| [demo_play](#demo_play) | Intermediate | Full wallet demo — passkey registration, deterministic addresses, modern UI | Next.js |
| [multisig-wallet](#multisig-wallet) | Advanced | M-of-N multisig with off-chain (Veridex SDK) and on-chain (Solidity) modes | Next.js + Prisma |
| [basic/](#basic-scripts) | Beginner | CLI scripts — create wallet, balances, transfers, bridging, gasless | TypeScript (Node) |
| [sessions/](#session-scripts) | Intermediate | CLI scripts — session key creation, batch execution, revocation | TypeScript (Node) |
| [advanced/](#advanced-scripts) | Intermediate | CLI scripts — VAA verification, session lifecycle | TypeScript (Node) |
| [integrations/](#integrations) | Advanced | Patterns — payment gateway, NFT marketplace, DeFi vault, gaming | Various |
| [contracts/](#contracts) | Advanced | Hardhat project — deploy and test Veridex contracts | Solidity + Hardhat |

---

## Quick Start

```bash
# Install all workspace dependencies from the monorepo root
bun install

# Then cd into any example and run it
cd examples/react-passkey-demo && bun run dev
```

---

## Web Application Examples

### react-passkey-demo

The simplest possible React example — create a passkey wallet and disconnect it.

```bash
cd examples/react-passkey-demo
bun install
bun run dev
# Open http://localhost:5173
```

**What it demonstrates:**
- `sdk.passkey.register()` — WebAuthn passkey registration
- `sdk.passkey.saveToLocalStorage()` / `loadFromLocalStorage()` — credential persistence
- `sdk.getVaultAddress()` — deterministic vault address derivation
- `sdk.passkey.authenticate()` — reconnect with discoverable credentials

**Stack:** React 19, Vite 6, `@veridex/sdk`

---

### agent-basic

Minimal Next.js app showing how to use `@veridex/agentic-payments` with a passkey wallet. Best starting point for agent development.

```bash
cd examples/agent-basic
bun install
bun run dev
# Open http://localhost:3000
```

**What it demonstrates:**
1. Create passkey wallet in the browser (`@veridex/sdk`)
2. Send credential to server → `createAgentWallet()` with session keys and spending limits
3. Check token balances via `agent.getBalance()`
4. Send USDC payments via `agent.pay()`
5. Monitor session status via `agent.getSessionStatus()`
6. Revoke session via `agent.revokeSession()`

**Architecture:**
```
Browser (@veridex/sdk)  →  POST /api/agent  →  Server (@veridex/agentic-payments)
  passkey.register()                            createAgentWallet()
  sends credential                              agent.pay() / getBalance()
```

> **Important:** The `@veridex/agentic-payments` SDK relies on `@veridex/sdk` and requires a **passkey wallet created via a browser frontend**. Passkey operations use WebAuthn APIs and cannot run server-side.

**Stack:** Next.js 14 (App Router), `@veridex/sdk`, `@veridex/agentic-payments`

**Docs:** [Agent Payments Guide](https://docs.veridex.network/guides/agent-payments)

---

### agent-advanced

Production-grade AI agent with Gemini chat, MCP tool integration, ERC-8004 identity/reputation, trust-gated payments, multi-chain support, and the full Agent-Safe Execution Control Plane (policy engine, security firewall, trace & evidence, escalation, circuit breaker).

```bash
cd examples/agent-advanced
cp .env.example .env.local
# Add GOOGLE_API_KEY=your-gemini-key to .env.local

bun install
bun run dev
# Open http://localhost:3001
```

**What it demonstrates:**
1. Everything in `agent-basic`, plus:
2. **Gemini AI chat** with function calling — the AI can check balances and make payments through natural language
3. **MCP tools → Gemini function declarations** — `agent.getMCPTools()` mapped to Gemini's `functionDeclarations`
4. **5 Payment Protocols** — x402, UCP, ACP, MPP, AP2 with automatic selection via `ProtocolRegistry`
5. **ERC-8004 identity** (optional) — register on-chain agent identity, check merchant reputation
6. **Trust-gated payments** — reject merchants below a reputation threshold
7. **Policy Engine** — configurable spending limits, velocity controls, asset/chain whitelists
8. **Security Firewall** — injection detection, tool sanitization, output guard, anomaly detection
9. **Trace & Evidence** — cryptographic audit trails with pluggable storage backends
10. **Escalation & Circuit Breaker** — human approval for high-value actions, cascading failure protection
11. **Multi-chain** — Base Sepolia + Ethereum Sepolia

**Key files:**

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Sidebar + chat UI |
| `src/app/api/agent/route.ts` | Agent provisioning, balance, pay, revoke |
| `src/app/api/chat/route.ts` | Gemini AI with MCP function calling |
| `src/lib/agent-wallet.ts` | Singleton AgentWallet factory |
| `src/lib/gemini-agent.ts` | MCP tools → Gemini function declarations |

**Prerequisites:**
- [Google Gemini API Key](https://aistudio.google.com/apikey)
- Testnet USDC from [Circle Faucet](https://faucet.circle.com)

**Stack:** Next.js 14, `@veridex/sdk`, `@veridex/agentic-payments`, `@google/generative-ai`, ethers v6

**Docs:** [Agent Payments Guide](https://docs.veridex.network/guides/agent-payments) · [Agent Identity Guide](https://docs.veridex.network/guides/agent-identity)

---

### demo_play

Full-featured wallet demo with passkey registration, deterministic addresses, and a polished glassmorphism UI.

```bash
cd examples/demo_play
bun install
bun run dev
```

**What it demonstrates:**
- Passkey wallet creation with Touch ID / Face ID / security keys
- Deterministic vault addresses across all EVM chains
- Client-side only — no backend required
- Modern glassmorphism UI with animations

**Stack:** Next.js, `@veridex/sdk`

---

### multisig-wallet

Production-grade multisig wallet with two approaches to multi-signer transaction approval.

```bash
cd examples/multisig-wallet
bun install
bun run dev
```

**What it demonstrates:**
1. **Off-Chain Multisig (Veridex SDK)** — Gasless, passkey-based multisig using pre-deployed vault contracts with off-chain proposal coordination and relayer execution
2. **On-Chain Multisig (Smart Contract)** — Fully trustless on-chain multisig using a custom Solidity contract

Both support M-of-N approval thresholds, proposal lifecycle management, and signer administration.

**Stack:** Next.js, Prisma, `@veridex/sdk`, Solidity

---

## CLI Script Examples

> **Note:** These scripts demonstrate SDK usage patterns. WebAuthn/Passkey operations require a browser environment — in Node.js, passkey registration will fail (expected). Use these to understand the API flow.

### Basic Scripts

```bash
bun run basic:wallet       # Create a passkey wallet
bun run basic:balances     # Check balances across chains
bun run basic:send         # Send tokens
bun run basic:crosschain   # Bridge tokens cross-chain
bun run basic:gasless      # Execute gasless transactions
```

### Session Scripts

```bash
bun run session:create     # Create a session key
bun run session:execute    # Execute batch transactions without passkey prompts
bun run session:revoke     # Revoke a session
```

### Advanced Scripts

```bash
bun run advanced:vaa       # Verify Wormhole VAAs
bun run advanced:session   # Complete session lifecycle
```

---

## Contracts

Hardhat project for deploying and testing Veridex contracts locally.

```bash
cd examples/contracts
bun install
npx hardhat compile
npx hardhat test
```

---

## Integrations

Pattern examples for real-world use cases:

| Integration | Description |
|-------------|-------------|
| `integrations/payment-gateway/` | Accept crypto payments with passkey wallets |
| `integrations/nft-marketplace/` | NFT trading with passkey authentication |
| `integrations/defi-vault/` | DeFi yield vault integration |
| `integrations/gaming/` | In-game asset management |

---

## Next.js Webpack Configuration

When using `@veridex/sdk` or `@veridex/agentic-payments` in a Next.js project, you need to configure `next.config.mjs` to handle transitive dependency resolution issues:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@veridex/sdk', '@veridex/agentic-payments'],
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore problematic transitive deps from @aptos-labs/ts-sdk
    // that reference unexported paths in @noble/curves
    config.resolve.alias = {
      ...config.resolve.alias,
      '@aptos-labs/ts-sdk': false,
    };

    return config;
  },
};

export default nextConfig;
```

This is required because `@veridex/sdk` includes multi-chain support (Aptos, Sui, etc.) and some transitive dependencies reference module paths that webpack cannot resolve by default.

---

## Supported Chains

| Chain | Network | Status | Type |
|-------|---------|--------|------|
| Base | Testnet/Mainnet | ✅ | Hub (EVM) |
| Optimism | Testnet/Mainnet | ✅ | Spoke (EVM) |
| Arbitrum | Testnet/Mainnet | ✅ | Spoke (EVM) |
| Ethereum | Testnet/Mainnet | ✅ | Spoke (EVM) |
| Polygon | Testnet/Mainnet | ✅ | Spoke (EVM) |
| Solana | Devnet/Mainnet | ✅ | Spoke |
| Aptos | Testnet/Mainnet | ✅ | Spoke |
| Sui | Testnet/Mainnet | ✅ | Spoke |
| Starknet | Sepolia/Mainnet | ✅ | Spoke |

## Environment Setup

Create a `.env` file (see `.env.example`):

```env
# Optional: Custom RPC URLs
BASE_RPC_URL=https://sepolia.base.org
OPTIMISM_RPC_URL=https://sepolia.optimism.io

# Optional: Relayer for gasless transactions
RELAYER_URL=https://relayer.veridex.network
RELAYER_API_KEY=your-api-key

# For examples that require gas payment
PRIVATE_KEY=your_deployer_key_here

# For agent-advanced: Gemini AI
GOOGLE_API_KEY=your-gemini-api-key
```

## Browser Support

WebAuthn requires a secure context (HTTPS or localhost):

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 67+ |
| Firefox | 60+ |
| Safari | 14+ |
| Edge | 18+ |

## Troubleshooting

| Error | Solution |
|-------|----------|
| "No credential set" | Run passkey registration first |
| "Insufficient balance" | Fund your vault/session wallet with testnet tokens from a faucet |
| "WebAuthn not supported" | Use HTTPS or localhost in a compatible browser |
| "VAA not found" | VAAs take 15–30 seconds to finalize — wait and retry |
| "Session expired" | Create a new session or re-provision the agent |
| `@noble/curves` module error | Add the [Next.js webpack config](#nextjs-webpack-configuration) to your `next.config.mjs` |
| "Agent not provisioned" | Create a passkey wallet in the browser first, then provision the agent |

## License

MIT

## Links

- [Official Documentation](https://docs.veridex.network) · [Mirror](https://veridex-documentation.vercel.app/)
- [SDK Repository](https://github.com/Veridex-Protocol/veridex-typescript-sdk)
- [Discord](https://discord.gg/veridex)
- [Twitter](https://twitter.com/VeridexProtocol)
