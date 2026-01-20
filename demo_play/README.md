# Veridex Wallet Demo

A Next.js application demonstrating how to create passkey-based Web3 wallets using the [Veridex SDK](https://github.com/veridex/sdk).

## 🎯 Features

- **Passkey Registration**: Create wallets using Touch ID, Face ID, or security keys
- **Deterministic Addresses**: Same address across all EVM chains (Base, Optimism, Arbitrum, etc.)
- **No Seed Phrases**: No private keys or seed phrases to manage
- **Client-Side Only**: Runs entirely in the browser, no backend required
- **Modern UI**: Glassmorphism design with smooth animations

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Modern browser with WebAuthn support (Chrome 67+, Firefox 60+, Safari 14+, Edge 18+)
- HTTPS connection (required for WebAuthn)

### Installation

1. Install dependencies from the root:
   ```bash
   npm install
   # or
   bun install
   ```

2. Navigate to the demo directory:
   ```bash
   cd examples/demo_play
   ```

3. Run the development server:
   ```bash
   npm run dev
   # or
   bun run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
demo_play/
├── src/
│   └── app/
│       ├── page.tsx        # Main component with SDK integration
│       ├── layout.tsx      # Root layout with fonts and metadata
│       ├── globals.css     # Global styles and design system
│       └── favicon.ico     # App icon
├── public/                 # Static assets
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🔑 How It Works

### 1. SDK Initialization

The app initializes the Veridex SDK on component mount:

```typescript
const { createSDK } = await import('@veridex/sdk');
const sdk = createSDK('base'); // Base Sepolia testnet
```

### 2. Passkey Registration

When the user clicks "Create Wallet", the app triggers WebAuthn:

```typescript
const credential = await sdk.passkey.register(username, 'Demo Wallet');
```

This prompts the user for biometric authentication (Touch ID, Face ID, etc.)

### 3. Address Derivation

After registration, the app derives the deterministic vault address:

```typescript
const address = sdk.getVaultAddress();
```

This address is:
- Derived from the passkey's public key
- The same on all EVM chains
- A smart contract wallet (not an EOA)
- Controlled by passkey signatures

## 🎨 Design System

The app uses a modern dark theme with:

- **Colors**: Dark background with indigo accents
- **Effects**: Glassmorphism (backdrop blur, transparency)
- **Typography**: Geist Sans and Geist Mono fonts
- **Animations**: Smooth transitions and hover effects

### CSS Variables

```css
--primary: #6366f1;        /* Indigo - main actions */
--background: #0a0a0c;     /* Dark background */
--card-bg: rgba(22, 22, 28, 0.6); /* Semi-transparent cards */
--success: #10b981;        /* Green - success states */
--error: #ef4444;          /* Red - error states */
```

## 🔒 Security

- **Passkeys Only**: No private keys or seed phrases
- **Device-Bound**: Passkey never leaves the device
- **Biometric Protected**: Requires Touch ID, Face ID, or security key
- **HTTPS Required**: WebAuthn only works in secure contexts
- **No Backend**: All operations happen client-side

## 🌐 Browser Support

| Browser | Minimum Version | Status |
|---------|----------------|--------|
| Chrome | 67+ | ✅ Supported |
| Firefox | 60+ | ✅ Supported |
| Safari | 14+ | ✅ Supported |
| Edge | 18+ | ✅ Supported |

## 📚 Code Documentation

All code files include comprehensive comments explaining:

- **What**: What the code does
- **Why**: Why it's implemented this way
- **How**: How it works under the hood
- **Security**: Security considerations

### Key Files

- `src/app/page.tsx`: Main component with detailed SDK integration comments
- `src/app/layout.tsx`: Root layout with font and metadata setup
- `src/app/globals.css`: Complete design system with CSS comments

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Environment Variables

No environment variables required! The app uses:
- Base Sepolia testnet (default)
- Public RPC endpoints
- Client-side only operations

### Customization

To use a different chain or network:

```typescript
// Mainnet
const sdk = createSDK('base', { network: 'mainnet' });

// Custom RPC
const sdk = createSDK('base', { 
  rpcUrl: 'https://my-rpc.example.com' 
});

// With relayer (gasless)
const sdk = createSDK('base', {
  relayerUrl: 'https://relayer.veridex.network',
});
```

## 🐛 Troubleshooting

### "WebAuthn not supported"
- Ensure you're using a modern browser
- Check that you're on HTTPS (or localhost)
- Verify WebAuthn is enabled in browser settings

### "Passkey request cancelled"
- User dismissed the biometric prompt
- Try again and complete the authentication

### "Failed to initialize SDK"
- Check browser console for errors
- Ensure you have internet connection
- Try refreshing the page

## 📖 Learn More

- [Veridex SDK Documentation](https://docs.veridex.network)
- [WebAuthn Guide](https://webauthn.guide)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)

## 📄 License

MIT

## 🤝 Contributing

This is a demo application. For SDK contributions, see the main [Veridex SDK repository](https://github.com/veridex/sdk).
