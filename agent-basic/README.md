# Veridex Agent — Basic Example

The simplest Next.js example showing how to use `@veridex/agentic-payments` with a passkey wallet.

## What This Demonstrates

1. **Create Passkey Wallet** (browser) — Register a WebAuthn passkey using `@veridex/sdk`
2. **Provision Agent** (server) — Send the credential to a Next.js API route that creates an `AgentWallet` with session keys and spending limits
3. **Make Payments** — Send USDC on Base Sepolia using the agent's session key
4. **Check Balances** — Query token balances via the agent
5. **Revoke Session** — Destroy the session key when done

## Architecture

```
┌─────────────────────────────────┐
│  Browser (React)                │
│  • @veridex/sdk                 │
│  • Passkey registration         │
│  • Sends credential to backend  │
└──────────┬──────────────────────┘
           │ POST /api/agent
┌──────────▼──────────────────────┐
│  Next.js API Route (Server)     │
│  • @veridex/agentic-payments    │
│  • createAgentWallet()          │
│  • agent.pay() / getBalance()   │
└─────────────────────────────────┘
```

> **Important:** The `@veridex/sdk` passkey operations (`register`, `authenticate`) use WebAuthn
> browser APIs and **must run in the browser**. The `@veridex/agentic-payments` agent wallet
> runs on the **server** and uses the passkey credential to derive session keys.

## Quick Start

```bash
# From the monorepo root
cd examples/agent-basic
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Prerequisites

- **WebAuthn-capable browser** (Chrome, Safari, Firefox)
- **Testnet USDC** on Base Sepolia — get from [Circle Faucet](https://faucet.circle.com)
- Fund the **session wallet address** shown in the UI (not the vault address)

## SDK APIs Used

### Frontend (`@veridex/sdk`)
```typescript
import { createSDK } from '@veridex/sdk';
const sdk = createSDK('base');
const credential = await sdk.passkey.register('alice', 'alice');
```

### Backend (`@veridex/agentic-payments`)
```typescript
import { createAgentWallet } from '@veridex/agentic-payments';

const agent = await createAgentWallet({
  masterCredential: { credentialId, publicKeyX, publicKeyY, keyHash },
  session: { dailyLimitUSD: 50, perTransactionLimitUSD: 10, expiryHours: 24, allowedChains: [10004] },
});

const status = agent.getSessionStatus();
const tokens = await agent.getBalance(10004);
const receipt = await agent.pay({ chain: 10004, token: 'USDC', amount: '5000000', recipient: '0x...' });
await agent.revokeSession();
```

## Tech Stack

- **Next.js 14** (App Router)
- **@veridex/sdk** — Passkey wallet (browser)
- **@veridex/agentic-payments** — Agent wallet with session keys (server)
