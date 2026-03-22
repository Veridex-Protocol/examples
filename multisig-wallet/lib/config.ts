// Veridex Multisig Wallet Configuration

// Relayer URL configuration
const RELAYER_DIRECT_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'https://amused-kameko-veridex-demo-37453117.koyeb.app/api/v1';
const RELAYER_PROXY_URL = '/api/relayer';
const relayerUrl = process.env.NODE_ENV === 'production' ? RELAYER_PROXY_URL : RELAYER_DIRECT_URL;

// RPC URLs
const RPC_URLS = {
    baseSepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
};

// Base Sepolia (Hub Chain)
export const config = {
    chainId: 84532,
    wormholeChainId: 10004,
    rpcUrl: RPC_URLS.baseSepolia,
    hubContract: '0x23a39c294891703146c3607e1FEEB5Fe78F7F28d',
    wormholeCoreBridge: '0x79A1027a6A159502049F10906D333EC57E95F083',
    chainName: 'Base Sepolia',
    explorerUrl: 'https://sepolia.basescan.org',
    vaultFactory: '0x31e8dc9428575334739754Ab2bdB0E8b9Dc707FD',
    vaultImplementation: '0x0d13367C16c6f0B24eD275CC67C7D9f42878285c',
    relayerUrl,
};

// Multisig-specific configuration
export const multisigConfig = {
    // Default threshold for new multisig wallets (2-of-3)
    defaultThreshold: 2,
    // Maximum number of signers
    maxSigners: 10,
    // Minimum number of signers
    minSigners: 2,
};
