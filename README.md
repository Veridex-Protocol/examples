# Veridex Protocol Examples

Production-ready examples demonstrating how to integrate with the Veridex Protocol for cross-chain passkey authentication.

## Overview

Veridex enables **passwordless, cross-chain authentication** using WebAuthn/Passkeys (P-256/secp256r1). Users get a deterministic vault address across all chains derived from their passkey.

## Quick Start

```bash
# Install dependencies
npm install

# Run basic wallet creation example
npm run basic:wallet
```

## Examples Structure

```
examples/
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
├── advanced/               # Advanced features
│   ├── 01-vaa-verify.ts       # VAA verification and security
│   └── 02-session-lifecycle.ts # Complete session lifecycle
│
└── integrations/           # Real-world integration patterns
    ├── payment-gateway/       # Accept crypto payments
    ├── nft-marketplace/       # NFT trading with passkeys
    ├── defi-vault/            # DeFi yield vault integration
    └── gaming/                # In-game asset management
```

## Running Examples

**Important Note:** These examples are designed to demonstrate SDK usage patterns. WebAuthn/Passkey functionality requires a browser environment with HTTPS. When running in Node.js:
- Passkey registration will fail (expected)
- Examples will show the proper API usage
- You can see the flow and error handling
- In production, use these patterns in a browser application

### Basic Examples

```bash
# Create a passkey wallet
npm run basic:wallet

# Check balances across chains
npm run basic:balances

# Send tokens
npm run basic:send

# Bridge tokens cross-chain
npm run basic:crosschain

# Execute gasless transactions
npm run basic:gasless
```

### Session Examples

```bash
# Create a session key
npm run session:create

# Execute batch transactions without passkey prompts
npm run session:execute

# Revoke a session
npm run session:revoke
```

### Advanced Examples

```bash
# Verify Wormhole VAAs
npm run advanced:vaa

# Complete session lifecycle
npm run advanced:session
```

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

## Key Concepts

### 1. Vault Address Derivation

Users get the **same address** on all EVM chains, derived from their passkey:

```typescript
import { createSDK } from '@veridex/sdk';

const sdk = createSDK('base');
await sdk.passkey.register('user@example.com', 'My Wallet');
const vaultAddress = sdk.getVaultAddress(); // Same on all EVM chains!
```

### 2. Gasless Transactions

Users never need to hold gas tokens - relayers pay fees:

```typescript
const sdk = createSDK('base', { 
  relayerUrl: 'https://relayer.veridex.network' 
});

await sdk.transferViaRelayer({
  token: 'native',
  recipient: '0x...',
  amount: parseEther('0.1'),
  targetChain: 10004,
}); // No gas needed!
```

### 3. Session Keys

Create temporary keys for seamless UX without repeated passkey prompts:

```typescript
import { SessionManager, EVMHubClientAdapter } from '@veridex/sdk';

const hubClient = new EVMHubClientAdapter(sdk.getChainClient());
const sessionManager = new SessionManager({
  hubClient,
  passkeyManager: sdk.passkey,
});

const session = await sessionManager.createSession({
  duration: 3600, // 1 hour
  maxValue: parseEther('0.1'),
});

// Execute multiple transactions without biometric prompts
await sessionManager.executeWithSession(params, session, signer);
```

### 4. Cross-Chain Messaging

Transfer assets and execute actions across chains:

```typescript
await sdk.bridge({
  sourceChain: 10004, // Base Sepolia
  token: USDC_ADDRESS,
  amount: parseUnits('100', 6),
  destinationChain: 10005, // Optimism Sepolia
  recipient: vaultAddress,
});
```

## Security Model

- **Passkey-Only**: No seed phrases, no private keys to lose
- **Deterministic Vaults**: Same address derived from passkey across chains
- **RIP-7212 Support**: ~95x cheaper signature verification on supported chains
- **Wormhole VAA**: Cross-chain messages secured by Guardian network (13/19 quorum)
- **Replay Protection**: Nonce-based action deduplication
- **Session Bounds**: Time-limited with value caps for delegated access

## Environment Setup

Create a `.env` file:

```env
# Optional: Custom RPC URLs
BASE_RPC_URL=https://sepolia.base.org
OPTIMISM_RPC_URL=https://sepolia.optimism.io

# Optional: Relayer for gasless transactions
RELAYER_URL=https://relayer.veridex.network
RELAYER_API_KEY=your-api-key

# For examples that require gas payment
PRIVATE_KEY=your_deployer_key_here

# Optional: Sponsor key for gasless vault creation
SPONSOR_PRIVATE_KEY=your_sponsor_key_here
```

## API Reference

### Core SDK

```typescript
import { createSDK } from '@veridex/sdk';

// Create SDK instance
const sdk = createSDK('base', {
  network: 'testnet', // or 'mainnet'
  rpcUrl: 'https://custom-rpc.example.com', // optional
  relayerUrl: 'https://relayer.veridex.network', // optional
  relayerApiKey: 'your-api-key', // optional
});

// Register passkey
const credential = await sdk.passkey.register('user@example.com', 'My Wallet');

// Get vault address
const vaultAddress = sdk.getVaultAddress();

// Check balance
const balance = await sdk.getVaultNativeBalance();

// Transfer tokens
const prepared = await sdk.prepareTransfer({
  token: 'native',
  recipient: '0x...',
  amount: parseEther('0.1'),
  targetChain: 10004,
});
const result = await sdk.executeTransfer(prepared, signer);

// Bridge cross-chain
const bridgePrepared = await sdk.prepareBridge({
  sourceChain: 10004,
  token: 'native',
  amount: parseEther('0.1'),
  destinationChain: 10005,
  recipient: vaultAddress,
});
const bridgeResult = await sdk.executeBridge(bridgePrepared, signer);
```

### Session Manager

```typescript
import { SessionManager, EVMHubClientAdapter } from '@veridex/sdk';

const hubClient = new EVMHubClientAdapter(sdk.getChainClient());
const sessionManager = new SessionManager({
  hubClient,
  passkeyManager: sdk.passkey,
});

// Create session
const session = await sessionManager.createSession({
  duration: 3600,
  maxValue: parseEther('0.1'),
  requireUV: true,
});

// Execute with session
const result = await sessionManager.executeWithSession(
  {
    targetChain: 10004,
    token: 'native',
    recipient: '0x...',
    amount: parseEther('0.01'),
  },
  session,
  signer
);

// Check session status
const isActive = await sessionManager.isSessionActive(session);

// Revoke session
await sessionManager.revokeSession(session);
```

### Utilities

```typescript
import { 
  parseVAA,
  verifyVAASignatures,
  normalizeEmitterAddress,
  getSupportedChains,
  getHubChains,
} from '@veridex/sdk';

// Parse VAA
const vaa = parseVAA(vaaBytes);

// Verify signatures
const isValid = verifyVAASignatures(vaa);

// Get supported chains
const chains = getSupportedChains();
const hubs = getHubChains();
```

## Browser Support

WebAuthn requires a secure context (HTTPS) and a compatible browser:

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 67+ |
| Firefox | 60+ |
| Safari | 14+ |
| Edge | 18+ |

## TypeScript

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  ChainName,
  NetworkType,
  SimpleSDKConfig,
  TransferParams,
  BridgeParams,
  SessionKey,
  SessionConfig,
  PreparedTransfer,
  TransferResult,
} from '@veridex/sdk';
```

## Common Patterns

### Check if Vault Exists

```typescript
const exists = await sdk.vaultExists();
if (!exists) {
  await sdk.createVault(signer);
}
```

### Multi-Chain Balance Check

```typescript
const balances = await sdk.getMultiChainBalances([10004, 10005, 10003]);
for (const chainBalance of balances) {
  console.log(`${chainBalance.chainName}: ${chainBalance.tokens[0].formatted}`);
}
```

### Transaction with Progress Tracking

```typescript
const result = await sdk.executeTransfer(prepared, signer);
const state = await sdk.waitForTransaction(result.transactionHash);
console.log(`Confirmed in block ${state.blockNumber}`);
```

### Spending Limits Check

```typescript
const limitCheck = await sdk.checkSpendingLimit(parseEther('0.5'));
if (!limitCheck.allowed) {
  console.log('Transaction exceeds spending limits');
  console.log('Suggestions:', limitCheck.suggestions);
}
```

## Troubleshooting

### "No credential set"
Run `01-create-wallet.ts` first to register a passkey.

### "Insufficient balance"
Fund your vault with testnet tokens from a faucet.

### "WebAuthn not supported"
Ensure you're running in a secure context (HTTPS) with a compatible browser.

### "VAA not found"
VAAs take 15-30 seconds to finalize. Wait and retry.

### "Session expired"
Create a new session or refresh the existing one.

## License

MIT

## Links

- [Documentation](https://docs.veridex.network)
- [SDK Repository](https://github.com/Veridex-Protocol/sdk)
- [Discord](https://discord.gg/veridex)
- [Twitter](https://twitter.com/VeridexProtocol)
