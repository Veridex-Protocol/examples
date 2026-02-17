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
    hubContract: '0x66D87dE68327f48A099c5B9bE97020Feab9a7c82',
    wormholeCoreBridge: '0x79A1027a6A159502049F10906D333EC57E95F083',
    chainName: 'Base Sepolia',
    explorerUrl: 'https://sepolia.basescan.org',
    vaultFactory: '0xCFaEb5652aa2Ee60b2229dC8895B4159749C7e53',
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
