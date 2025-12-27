# Veridex Protocol Examples

This directory contains production-ready examples demonstrating how to integrate with the Veridex Protocol for cross-chain passkey authentication.

## Overview

Veridex enables **passwordless, cross-chain authentication** using WebAuthn/Passkeys (P-256/secp256r1). Users get a deterministic vault address across all chains derived from their passkey.

## Quick Start

```bash
# Install dependencies
cd examples
npm install

# Run basic example
npx ts-node basic/01-create-wallet.ts
```

## Examples Structure

```
examples/
├── contracts/              # Solidity contracts integrating with Veridex
│   ├── PaymentGateway.sol     # Accept payments to Veridex vaults
│   ├── NFTGatedAccess.sol     # NFT access control via vault ownership
│   ├── SubscriptionManager.sol # Recurring payments from vaults
│   ├── CrossChainEscrow.sol   # Cross-chain escrow with passkey auth
│
│
├── basic/                  # Core SDK usage patterns
│   ├── 01-create-wallet.ts    # Create passkey wallet
│   ├── 02-get-balances.ts     # Query multi-chain balances
│   ├── 03-send-tokens.ts      # Transfer tokens
│   ├── 04-cross-chain.ts      # Cross-chain bridging
│   └── 05-gasless.ts          # Gasless transactions via relayer
│
├── sessions/               # Session key management
│   ├── 01-create-session.ts   # Create time-limited session
│   ├── 02-execute-batch.ts    # Batch transactions with session
│   └── 03-revoke-session.ts   # Revoke session key
│
├── integrations/           # Real-world integration patterns
│   ├── payment-gateway/       # Accept crypto payments
│   ├── nft-marketplace/       # NFT trading with passkeys
│   ├── defi-vault/            # DeFi yield vault integration
│   └── gaming/                # In-game asset management

```

## Supported Chains

| Chain | Network | Status |
|-------|---------|--------|
| Base | Testnet/Mainnet | OK Hub Chain |
| Optimism | Testnet/Mainnet | OK Spoke |
| Arbitrum | Testnet/Mainnet | OK Spoke |
| Solana | Devnet/Mainnet | OK Spoke |
| Sui | Testnet/Mainnet | OK Spoke |
| Aptos | Testnet/Mainnet | OK Spoke |
| Starknet | Sepolia/Mainnet | OK Spoke |

## Key Concepts

### 1. Vault Address Derivation
Users get the **same address** on all EVM chains, derived from their passkey:
```typescript
const sdk = createSDK('base');
await sdk.passkey.register('user@example.com', 'My Wallet');
const vaultAddress = sdk.getVaultAddress(); // Same on all EVM chains!
```

### 2. Gasless Transactions
Users never need to hold gas tokens - relayers pay fees:
```typescript
const sdk = createSDK('base', { 
  relayerUrl: 'https://relayer.veridex.io' 
});
await sdk.transferViaRelayer({ ... }); // No gas needed!
```

### 3. Session Keys
Create temporary keys for seamless UX without repeated passkey prompts:
```typescript
const session = await sdk.sessions.create({
  duration: 3600, // 1 hour
  maxValue: parseEther('0.1'),
});
// Now execute multiple transactions without biometric prompts
```

### 4. Cross-Chain Messaging
Transfer assets and execute actions across chains:
```typescript
await sdk.bridge({
  targetChain: 'optimism',
  token: USDC_ADDRESS,
  amount: parseUnits('100', 6),
});
```

## Security Model

- **Passkey-Only**: No seed phrases, no private keys to lose
- **Deterministic Vaults**: Same address derived from passkey across chains
- **RIP-7212 Support**: ~95x cheaper signature verification on supported chains
- **Wormhole VAA**: Cross-chain messages secured by Guardian network
- **Session Bounds**: Sessions are time-limited with value caps

## Environment Setup

Create a `.env` file:
```env
# Optional: Custom RPC URLs
BASE_RPC_URL=https://sepolia.base.org
OPTIMISM_RPC_URL=https://sepolia.optimism.io

# Optional: Relayer for gasless transactions
RELAYER_URL=http://localhost:3001

# For contract deployment examples
PRIVATE_KEY=your_deployer_key_here
```

## Running Examples

### Basic Wallet Creation
```bash
npx ts-node basic/01-create-wallet.ts
```

### Gasless Transfer
```bash
npx ts-node basic/05-gasless.ts
```

### Deploy Example Contract
```bash
cd contracts
npx hardhat run scripts/deploy-payment-gateway.ts --network baseSepolia
```

## License

MIT
