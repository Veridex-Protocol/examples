# Veridex Passkey Wallet Demo

The simplest possible React example using `@veridex/sdk` — create a passkey wallet and disconnect it.

## What This Demonstrates

1. **Create Wallet** — Register a WebAuthn passkey, derive a vault address, and persist the credential to localStorage
2. **Disconnect Wallet** — Clear the in-memory credential and remove it from localStorage

## Quick Start

```bash
# From the monorepo root
cd examples/react-passkey-demo
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Note:** WebAuthn requires a secure context (HTTPS or localhost). Vite's dev server on `localhost` works out of the box.

## SDK API Used

```typescript
import { createSDK } from '@veridex/sdk';

const sdk = createSDK('base');

// Register a new passkey
const credential = await sdk.passkey.register('alice', 'alice');

// Persist to localStorage
sdk.passkey.saveToLocalStorage();

// Get vault address
const vault = sdk.getVaultAddress();

// Restore on page reload
sdk.passkey.loadFromLocalStorage();

// Disconnect
sdk.passkey.clearCredential();
sdk.passkey.removeFromLocalStorage();
```

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 6** — dev server & bundler
- **@veridex/sdk** — passkey wallet SDK
