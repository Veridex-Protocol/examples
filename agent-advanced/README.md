# Veridex Agent — Advanced Example

A production-grade Next.js app demonstrating the full power of `@veridex/agentic-payments`: AI-powered chat with Gemini, MCP tool integration, ERC-8004 identity/reputation, trust-gated payments, multi-chain support, and the Agent-Safe Execution Control Plane.

## What This Demonstrates

1. **Passkey Wallet** (browser) — Create a WebAuthn passkey via `@veridex/sdk`
2. **Agent Provisioning** (server) — Create an `AgentWallet` with configurable session keys, spending limits, and optional ERC-8004 identity
3. **AI Chat with Function Calling** — Gemini 2.0 Flash with MCP tools mapped to function declarations
4. **Autonomous Payments** — The AI agent can check balances, send USDC, and report transaction results through natural language
5. **5 Payment Protocols** — x402, UCP, ACP, MPP, AP2 with automatic protocol selection via `ProtocolRegistry`
6. **ERC-8004 Identity** (optional) — Register on-chain agent identity, check merchant reputation, trust-gated payments
7. **Agent-Safe Control Plane** — Policy engine, security firewall (injection detection, tool sanitization, output guard), trace & evidence, escalation manager, circuit breaker
8. **Session Management** — Real-time budget tracking, session refresh, and revocation

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser (React)                                     │
│  • @veridex/sdk — passkey registration               │
│  • Chat UI — sends messages to /api/chat             │
│  • Sidebar — wallet status, session config           │
└──────────┬───────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────┐
│  Next.js API Routes (Server)                         │
│                                                      │
│  /api/agent — provision, status, balance, pay, revoke│
│  /api/chat  — Gemini AI with MCP function calling    │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │  GeminiAgent     │  │  AgentWallet             │   │
│  │  • Chat loop     │  │  • Session keys          │   │
│  │  • Function calls│──│  • MCP tools             │   │
│  │  • Tool results  │  │  • x402/UCP/ACP/MPP/AP2  │   │
│  └─────────────────┘  │  • ERC-8004 identity      │   │
│                        │  • Trust gates            │   │
│                        │  • Policy engine          │   │
│                        │  • Security firewall      │   │
│                        │  • Trace & evidence       │   │
│                        └──────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# From the monorepo root
cd examples/agent-advanced
cp .env.example .env.local

# Add your Gemini API key to .env.local
# GOOGLE_API_KEY=your-key-here

bun install
bun run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Prerequisites

- **Google Gemini API Key** — Get from [Google AI Studio](https://aistudio.google.com/apikey)
- **WebAuthn-capable browser** (Chrome, Safari, Firefox)
- **Testnet USDC** on Base Sepolia — [Circle Faucet](https://faucet.circle.com)

## Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Frontend: passkey wallet + chat UI |
| `src/app/api/agent/route.ts` | Agent provisioning, balance, pay, revoke |
| `src/app/api/chat/route.ts` | Gemini AI chat with function calling |
| `src/lib/agent-wallet.ts` | Singleton AgentWallet factory |
| `src/lib/gemini-agent.ts` | MCP tools → Gemini function declarations |

## SDK APIs Used

### MCP Tools → Gemini Function Calling
```typescript
const mcpTools = agent.getMCPTools();
// Maps to: veridex_pay, veridex_check_balance, veridex_create_session_key, etc.

// Convert to Gemini function declarations
const tools = mcpTools.map(tool => ({
  declaration: { name: tool.name, description: tool.description, parameters: { ... } },
  execute: (args) => tool.handler(args),
}));
```

### ERC-8004 Identity & Reputation
```typescript
const agent = await createAgentWallet({
  // ...
  erc8004: { enabled: true, testnet: true, minReputationScore: 20 },
});

// Register on-chain identity (mints ERC-721 NFT)
const { agentId } = await agent.register({ name: 'My Agent', services: [...] });

// Check merchant trust before paying
const trust = await agent.checkMerchantTrust('https://merchant.com');

// Submit reputation feedback
await agent.submitFeedback(targetAgentId, { score: 85, tags: ['fast', 'reliable'] });
```

### Universal Fetch (Auto-Protocol Detection)
```typescript
// Automatically detects x402, UCP, ACP, or AP2 and handles payment
const response = await agent.fetch('https://paid-api.example.com/data', {
  onBeforePayment: async (estimate) => estimate.amountUSD < 10,
  maxAutoApproveUSD: 5,
});
```

## Tech Stack

- **Next.js 14** (App Router)
- **@veridex/sdk** — Passkey wallet (browser)
- **@veridex/agentic-payments** — Agent wallet, MCP tools, ERC-8004 (server)
- **@google/generative-ai** — Gemini 2.0 Flash with function calling
- **ethers v6** — EVM interactions
