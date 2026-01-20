/**
 * Veridex Demo App - Main Page Component
 * 
 * This is a Next.js client component that demonstrates the core functionality
 * of the Veridex SDK for creating passkey-based Web3 wallets.
 * 
 * Key Features:
 * - Passkey registration using WebAuthn (Touch ID, Face ID, etc.)
 * - Deterministic vault address generation
 * - Cross-chain address unification (same address on all EVM chains)
 * - Client-side only (no backend required)
 * 
 * Flow:
 * 1. User enters username/email
 * 2. User clicks "Create Wallet" → triggers WebAuthn prompt
 * 3. Passkey is registered and vault address is derived
 * 4. Display vault address and connection status
 * 
 * @see https://docs.veridex.network for full documentation
 */

'use client';

import { useState } from 'react';
import { sdk } from '@/lib/sdk';

export default function Home() {
  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Username/email for passkey registration
   * This is used as the display name in the WebAuthn prompt
   */
  const [username, setUsername] = useState('user@example.com');

  /**
   * Status message to display to user (e.g., "Registering passkey...")
   */
  const [status, setStatus] = useState('');

  /**
   * Error message if something goes wrong
   */
  const [error, setError] = useState('');

  /**
   * The derived vault address (deterministic, same across all EVM chains)
   */
  const [vaultAddress, setVaultAddress] = useState('');

  /**
   * Loading state for button and UI feedback
   */
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================================
  // Passkey Registration Handler
  // ============================================================================

  /**
   * Handle passkey registration and wallet creation
   */
  const handleRegister = async () => {
    // Reset state and show loading
    setIsLoading(true);
    setError('');
    setStatus('Registering passkey...');

    try {
      /**
       * Register passkey with Veridex
       * This will trigger the browser's WebAuthn prompt.
       */
      const credential = await sdk.passkey.register(username, 'Demo Wallet');

      console.log('✅ Passkey registered:', {
        credentialId: credential.credentialId,
        keyHash: credential.keyHash,
      });

      setStatus('Passkey registered successfully!');

      /**
       * Get the deterministic vault address
       * This address is derived from the passkey public key.
       */
      const address = sdk.getVaultAddress();

      console.log('✅ Vault address:', address);
      console.log('💡 This address is the same on all EVM chains!');

      setVaultAddress(address);

    } catch (e: any) {
      console.error('❌ Registration failed:', e);

      if (e.message?.includes('cancelled')) {
        setError('Passkey request cancelled. Please try again.');
      } else if (e.message?.includes('not supported')) {
        setError('WebAuthn not supported. Please use a modern browser with HTTPS.');
      } else {
        setError(e.message || 'Registration failed. Please try again.');
      }

      setStatus('');
    } finally {
      // Always reset loading state
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Render UI
  // ============================================================================

  return (
    <div className="container">
      <div className="card">
        {/* Header */}
        <h1 className="title">Veridex</h1>
        <p className="subtitle">Secure, Passkey-Based Web3 Wallet</p>

        {/* Registration Form (shown when not connected) */}
        {!vaultAddress ? (
          <>
            {/* Username Input */}
            <div className="input-group">
              <label className="label">Email / Username</label>
              <input
                className="input"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            {/* Register Button */}
            <button
              className="btn"
              onClick={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                // Loading spinner
                <div className="loader" />
              ) : (
                // Button text
                'Create Wallet with Passkey'
              )}
            </button>

            {/* Help Text */}
            <p className="label" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem' }}>
              Note: This will trigger your device's biometric or security key prompt (Touch ID, Face ID, etc).
            </p>
          </>
        ) : (
          /* Dashboard (shown when connected) */
          <div className="dashboard">
            {/* Connection Status */}
            <div className="status" style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'var(--primary)', color: 'white' }}>
              ✓ Wallet Connected
            </div>

            {/* Vault Information */}
            <div style={{ marginTop: '2rem' }}>
              {/* Vault Address */}
              <div className="info-row">
                <span className="info-label">Vault Address (EVM)</span>
              </div>
              <div className="input-group" style={{ marginTop: '0.5rem' }}>
                <input
                  className="input"
                  readOnly
                  value={vaultAddress}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  title="Click to select and copy"
                />
              </div>

              {/* Network Info */}
              <div className="info-row">
                <span className="info-label">Network</span>
                <span className="info-value">Base Sepolia</span>
              </div>

              {/* Wallet Type */}
              <div className="info-row">
                <span className="info-label">Type</span>
                <span className="info-value">Smart Account</span>
              </div>

              {/* Cross-Chain Info */}
              <p className="label" style={{ textAlign: 'center', marginTop: '2rem' }}>
                This address is deterministic and unified across all supported EVM chains (Base, Optimism, Arbitrum).
              </p>

              {/* Disconnect Button */}
              <button
                className="btn"
                onClick={() => {
                  // Reset state to show registration form again
                  setVaultAddress('');
                  setStatus('');
                  setError('');
                }}
                style={{ background: 'var(--secondary)', border: '1px solid var(--border)', marginTop: '2rem' }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && <div className="status error">{error}</div>}

        {/* Status Message (only when not connected and no error) */}
        {status && !error && !vaultAddress && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
