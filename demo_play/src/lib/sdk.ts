/**
 * SDK Wrapper for Demo App
 * 
 * Simplified Configuration following test-app pattern.
 */

import { createSDK } from '@veridex/sdk';

/**
 * Default SDK instance - Base Sepolia
 * initialized synchronously.
 */
export const sdk = createSDK('base', {
  network: 'testnet',
  // In a real app, you might want to configure RPC URLs here:
  // rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL
});
