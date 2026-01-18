# Veridex Wallet Demo

This is a simple Next.js application demonstrating how to create a passkey-based wallet using the [Veridex SDK](https://github.com/veridex/sdk).

## Features

- **Passkey Registration**: Create a wallet using Touch ID / Face ID.
- **Unified Identity**: Get a deterministic address that works across Base, Optimism, Arbitrum, etc.
- **Client-Side Only**: Runs entirely in the browser.

## Getting Started

1. Install dependencies (from root):
   ```bash
   bun install
   ```

2. Run the development server:
   ```bash
   cd examples/demo_play
   bun run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Code Overview

- `src/app/page.tsx`: Main logic for initializing the SDK and registering passkeys.
- `src/app/globals.css`: Custom styling.
