# Veridex Multisig Wallet Example

A production-grade multisig wallet application demonstrating **two approaches** to multi-signer transaction approval:

1. **Off-Chain Multisig (Veridex SDK)** — Gasless, passkey-based multisig using Veridex pre-deployed vault contracts with off-chain proposal coordination and relayer-based execution.
2. **On-Chain Multisig (Smart Contract)** — Fully trustless, on-chain multisig using a custom Solidity contract where all proposals, votes, and execution happen directly on the blockchain.

Both approaches support M-of-N approval thresholds, proposal lifecycle management, and signer administration.

---

## Table of Contents

- [Approach Comparison](#approach-comparison)
- [Approach 1: Off-Chain Multisig (Veridex SDK)](#approach-1-off-chain-multisig-veridex-sdk)
- [Approach 2: On-Chain Multisig (Smart Contract)](#approach-2-on-chain-multisig-smart-contract)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Approach Comparison

| Feature | Off-Chain (Veridex SDK) | On-Chain (Smart Contract) |
|---------|------------------------|--------------------------|
| **Gas costs** | Gasless — relayer pays gas | Signers pay gas for every vote & execution |
| **Authentication** | Passkeys (WebAuthn) | EOA wallets (MetaMask, etc.) |
| **Trust model** | Trust the relayer + backend DB | Fully trustless — all logic on-chain |
| **Proposal storage** | SQLite (Prisma ORM) | On-chain contract state |
| **Signer management** | Backend API | On-chain via governance proposals |
| **Notifications** | Backend push notifications | Event-based (listen to contract events) |
| **Deployment** | No contract deployment needed | Deploy MultisigFactory + per-wallet contracts |
| **Best for** | Consumer wallets, UX-first apps | DAOs, treasuries, high-value custody |
| **Complexity** | Lower — SDK handles most logic | Higher — requires Solidity + on-chain interaction |

---

## Approach 1: Off-Chain Multisig (Veridex SDK)

### How It Works

The Veridex SDK uses **pre-deployed vault contracts** on supported chains. The multisig logic (proposals, voting, threshold checks) runs **off-chain** in a Next.js backend with a SQLite database (via Prisma ORM). When a proposal reaches the required approvals, any signer can execute the transaction through the Veridex **relayer**, which submits it on-chain and pays the gas.

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ AuthScreen│  │Dashboard │  │ VaultPanel        │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────────────┘ │
│       └──────────────┼──────────────┘               │
│                      │                               │
│  ┌───────────────────┴────────────────────────────┐ │
│  │          MultisigContext (React Context)        │ │
│  │  - Passkey auth (register/login)               │ │
│  │  - Wallet CRUD via REST API                    │ │
│  │  - Proposal lifecycle (create/vote/execute)    │ │
│  │  - Balance queries                             │ │
│  │  - Notification polling                        │ │
│  └───────────┬────────────────────┬───────────────┘ │
│              │                    │                   │
│  ┌───────────┴──────┐  ┌────────┴─────────────────┐ │
│  │  REST API (Next)  │  │     @veridex/sdk         │ │
│  │  /api/wallets     │  │  - PasskeyManager        │ │
│  │  /api/proposals   │  │  - EVMClient             │ │
│  │  /api/invites     │  │  - GasSponsor            │ │
│  │  /api/notifications│  │  - RelayerClient        │ │
│  └───────┬──────────┘  └──────────────────────────┘ │
│          │                                           │
│  ┌───────┴──────────┐                               │
│  │  Prisma + SQLite  │                               │
│  │  (data/multisig.db)│                              │
│  └──────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

### Key Features

- **Passkey Authentication** — Register and sign in using WebAuthn (Face ID, Touch ID, security keys)
- **Gasless Vault Creation** — Deploy smart contract vaults without paying gas (sponsored)
- **Gasless Transfers** — Execute approved transactions via the Veridex relayer at zero gas cost
- **Invite System** — Add signers via shareable invite links
- **Notification System** — Real-time notifications for proposal events
- **Multiple Proposal Types** — Transfer, contract execution, and contract deployment

### Proposal Lifecycle

1. **Create** — Any active signer proposes a transaction (auto-approves their own vote)
2. **Vote** — Other signers approve or reject; status auto-updates when threshold is met or impossible
3. **Execute** — Once approved, any signer triggers execution via the relayer
4. **Notify** — All signers receive notifications at each stage

### SDK Patterns Used

- `new VeridexSDK()` + `EVMClient` — Direct SDK initialization
- `sdk.passkey.register()` / `sdk.passkey.authenticate()` — Passkey auth
- `sdk.createSponsoredVault()` — Gasless vault deployment
- `sdk.transferViaRelayer()` — Gasless transaction execution
- `sdk.balance.getPortfolioBalance()` — Balance queries
- `sdk.getUnifiedIdentity()` — Cross-chain identity

### Database Schema (Prisma)

The off-chain multisig stores all state in SQLite via Prisma ORM:

- **Wallet** — Multisig wallet metadata (name, threshold, vault address)
- **Signer** — Wallet signers (passkey key hash, name, status)
- **Invite** — Shareable invite links for adding signers
- **Proposal** — Transaction proposals (type, target, amount, status)
- **ProposalVote** — Individual signer votes on proposals
- **Notification** — Push notifications for proposal events

---

## Approach 2: On-Chain Multisig (Smart Contract)

### How It Works

The on-chain approach uses a custom **Solidity smart contract** (`MultisigWallet.sol`) where all multisig logic lives on-chain. Proposals, votes, and execution are all blockchain transactions. A **factory contract** (`MultisigFactory.sol`) deploys new multisig wallet instances.

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (dApp)                    │
│  ┌──────────────────────────────────────────────┐   │
│  │  Connect Wallet (MetaMask / WalletConnect)    │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                                │
│  ┌──────────────────┴───────────────────────────┐   │
│  │            ethers.js / viem                    │   │
│  └──────────────────┬───────────────────────────┘   │
└─────────────────────┼───────────────────────────────┘
                      │ JSON-RPC
┌─────────────────────┼───────────────────────────────┐
│                EVM Blockchain                        │
│  ┌──────────────────┴───────────────────────────┐   │
│  │           MultisigFactory.sol                 │   │
│  │  - createWallet(name, signers, threshold)     │   │
│  │  - getWalletsByCreator(address)               │   │
│  │  - getWalletsBySigner(address)                │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │ deploys                        │
│  ┌──────────────────┴───────────────────────────┐   │
│  │           MultisigWallet.sol                  │   │
│  │  - proposeTransfer / proposeExecute           │   │
│  │  - approve / reject                           │   │
│  │  - execute                                    │   │
│  │  - proposeAddSigner / proposeRemoveSigner     │   │
│  │  - proposeChangeThreshold                     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Key Features

- **Fully Trustless** — All logic enforced by smart contract; no backend required
- **Native ETH Transfers** — Propose and execute native currency transfers
- **ERC-20 Token Transfers** — Propose and execute token transfers
- **Arbitrary Contract Calls** — Execute any contract function via proposals
- **Signer Governance** — Add/remove signers and change thresholds via proposals
- **Proposal Expiration** — Configurable TTL prevents stale proposals
- **Auto-Approval** — Proposer's vote is automatically counted
- **Event-Driven** — All actions emit events for frontend indexing

### Contract API

#### MultisigFactory

| Function | Description |
|----------|-------------|
| `createWallet(name, signers, threshold, ttl)` | Deploy a new MultisigWallet |
| `getWalletsByCreator(address)` | Get wallets created by an address |
| `getWalletsBySigner(address)` | Get wallets where address is a signer |
| `getAllWallets()` | Get all deployed wallet addresses |

#### MultisigWallet

| Function | Description |
|----------|-------------|
| `proposeTransfer(title, desc, to, value)` | Propose a native currency transfer |
| `proposeTokenTransfer(title, desc, token, to, amount)` | Propose an ERC-20 transfer |
| `proposeExecute(title, desc, target, value, data)` | Propose an arbitrary contract call |
| `proposeAddSigner(title, desc, signer, newThreshold)` | Propose adding a signer |
| `proposeRemoveSigner(title, desc, signer, newThreshold)` | Propose removing a signer |
| `proposeChangeThreshold(title, desc, newThreshold)` | Propose changing the threshold |
| `approve(proposalId)` | Approve a pending proposal |
| `reject(proposalId)` | Reject a pending proposal |
| `execute(proposalId)` | Execute an approved proposal |
| `getSigners()` | Get all current signers |
| `getProposal(proposalId)` | Get proposal details |
| `getBalance()` | Get the wallet's native balance |

### Deployment

#### Using Hardhat

```bash
# Install Hardhat (in a separate project or globally)
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Configure hardhat.config.ts with your network (e.g., Monad Testnet)
# Then deploy:
npx hardhat run contracts/scripts/deploy.ts --network monadTestnet
```

#### Using Foundry

```bash
# Compile
forge build

# Deploy MultisigFactory
forge create contracts/MultisigFactory.sol:MultisigFactory \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# Create a wallet via the factory
cast send $FACTORY_ADDRESS \
  "createWallet(string,address[],uint256,uint256)" \
  "My Wallet" "[$SIGNER1,$SIGNER2,$SIGNER3]" 2 604800 \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Example: End-to-End On-Chain Flow

```typescript
import { ethers } from "ethers";

// 1. Connect to the factory
const factory = new ethers.Contract(FACTORY_ADDRESS, factoryABI, signer);

// 2. Create a 2-of-3 multisig wallet
const tx = await factory.createWallet(
  "Team Treasury",
  [signer1.address, signer2.address, signer3.address],
  2,       // threshold
  604800   // 7 day proposal TTL
);
const receipt = await tx.wait();
// Parse WalletDeployed event to get wallet address

// 3. Connect to the wallet
const wallet = new ethers.Contract(walletAddress, walletABI, signer1);

// 4. Fund the wallet
await signer1.sendTransaction({ to: walletAddress, value: ethers.parseEther("1.0") });

// 5. Propose a transfer (auto-approves as signer1)
const proposeTx = await wallet.proposeTransfer(
  "Pay contractor",
  "Monthly payment to dev contractor",
  recipientAddress,
  ethers.parseEther("0.5")
);
await proposeTx.wait();
// proposalId = 1

// 6. Second signer approves (reaches 2-of-3 threshold)
const walletAsSigner2 = wallet.connect(signer2);
await walletAsSigner2.approve(1);

// 7. Execute the approved proposal
await wallet.execute(1);
// 0.5 ETH sent to recipient
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** and **bun** (or npm/yarn)
- A browser with **WebAuthn support** (Chrome, Safari, Firefox)
- For on-chain approach: **Hardhat** or **Foundry** for contract deployment

### Setup

```bash
# From the repository root
cd examples/multisig-wallet

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env.local

# Initialize the database (Prisma)
bunx prisma generate
bunx prisma db push

# Start the development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path for Prisma | `file:./data/multisig.db` |
| `NEXT_PUBLIC_RELAYER_URL` | Veridex relayer for gasless transactions | Public demo relayer |
| `NEXT_PUBLIC_RELAYER_API_KEY` | Relayer API key (optional) | — |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint | `https://sepolia.base.org` |
| `NEXT_PUBLIC_INTEGRATOR_SPONSOR_KEY` | Sponsor key for gasless vault creation | — |
| `NEXT_PUBLIC_VERIDEX_SPONSOR_KEY` | Fallback sponsor key | — |

---

## Project Structure

```
multisig-wallet/
├── app/
│   ├── api/                        # Next.js API routes (off-chain multisig backend)
│   │   ├── wallets/                # Wallet CRUD + signers + proposals
│   │   ├── proposals/              # Vote + execute endpoints
│   │   ├── invites/                # Invite accept endpoint
│   │   └── notifications/          # Notification fetch + mark-read
│   ├── layout.tsx                  # Root layout with MultisigProvider
│   ├── page.tsx                    # Main page (auth or dashboard)
│   └── globals.css                 # Tailwind imports
├── components/
│   ├── AuthScreen.tsx              # Passkey registration/login
│   ├── Dashboard.tsx               # Main dashboard with tabs
│   ├── WalletList.tsx              # Multisig wallet list
│   ├── WalletDetail.tsx            # Wallet signers and details
│   ├── CreateWalletModal.tsx       # New wallet creation form
│   ├── ProposalList.tsx            # Transaction proposals
│   ├── CreateProposalModal.tsx     # New proposal form
│   └── VaultPanel.tsx              # Vault management and balances
├── contracts/                      # On-chain multisig (Approach 2)
│   ├── MultisigWallet.sol          # Core multisig contract
│   ├── MultisigFactory.sol         # Factory for deploying wallets
│   └── scripts/
│       └── deploy.ts               # Hardhat deployment script
├── lib/
│   ├── api.ts                      # Frontend API client
│   ├── config.ts                   # Chain and SDK configuration
│   ├── db.ts                       # Database access layer (Prisma)
│   ├── prisma.ts                   # Prisma client singleton
│   ├── MultisigContext.tsx          # React context with SDK integration
│   └── types.ts                    # Multisig-specific types
├── prisma/
│   └── schema.prisma               # Database schema (Prisma ORM)
├── .env.example
├── package.json
└── README.md
```

---

## Tech Stack

- **Next.js 16** — React framework with API routes
- **Tailwind CSS v4** — Styling
- **Prisma ORM** — Database access (SQLite)
- **@veridex/sdk** — Passkey wallet SDK
- **Solidity ^0.8.24** — On-chain multisig contracts
- **TypeScript** — Type safety throughout

---

## License

MIT
