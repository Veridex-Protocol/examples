'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [sdk, setSdk] = useState<any>(null);
  const [username, setUsername] = useState('user@example.com');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [vaultAddress, setVaultAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize SDK on client side only to ensure window is available
    if (typeof window !== 'undefined') {
      const initSdk = async () => {
        try {
          // Dynamic import to avoid SSR/circular dependency issues
          const { createSDK } = await import('@veridex/sdk');

          // Initialize for Base testnet by default
          const instance = createSDK('base');
          setSdk(instance);
        } catch (e) {
          console.error(e);
          setError('Failed to initialize SDK');
        }
      };

      initSdk();
    }
  }, []);

  const handleRegister = async () => {
    if (!sdk) return;
    setIsLoading(true);
    setError('');
    setStatus('Registering passkey...');

    try {
      // Register (or login) with passkey
      const credential = await sdk.passkey.register(username, 'Demo Wallet');
      setStatus('Passkey registered successfully!');

      const address = sdk.getVaultAddress();
      setVaultAddress(address);
    } catch (e: any) {
      console.error(e);
      // Handle "cancelled" or other WebAuthn errors
      if (e.message?.includes('cancelled')) {
        setError('Passkey request cancelled');
      } else {
        setError(e.message || 'Registration failed');
      }
      setStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Veridex</h1>
        <p className="subtitle">Secure, Passkey-Based Web3 Wallet</p>

        {!vaultAddress ? (
          <>
            <div className="input-group">
              <label className="label">Email / Username</label>
              <input
                className="input"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your email"
              />
            </div>

            <button
              className="btn"
              onClick={handleRegister}
              disabled={isLoading || !sdk}
            >
              {isLoading ? <div className="loader" /> : 'Create Wallet with Passkey'}
            </button>

            <p className="label" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem' }}>
              Note: This will trigger your device's biometric or security key prompt (Touch ID, Face ID, etc).
            </p>
          </>
        ) : (
          <div className="dashboard">
            <div className="status" style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'var(--primary)', color: 'white' }}>
              ✓ Wallet Connected
            </div>

            <div style={{ marginTop: '2rem' }}>
              <div className="info-row">
                <span className="info-label">Vault Address (EVM)</span>
              </div>
              <div className="input-group" style={{ marginTop: '0.5rem' }}>
                <input className="input" readOnly value={vaultAddress} onClick={(e) => (e.target as HTMLInputElement).select()} />
              </div>

              <div className="info-row">
                <span className="info-label">Network</span>
                <span className="info-value">Base Sepolia</span>
              </div>
              <div className="info-row">
                <span className="info-label">Type</span>
                <span className="info-value">Smart Account</span>
              </div>

              <p className="label" style={{ textAlign: 'center', marginTop: '2rem' }}>
                This address is deterministic and unified across all supported EVM chains (Base, Optimism, Arbitrum).
              </p>

              <button
                className="btn"
                onClick={() => {
                  setVaultAddress('');
                  setStatus('');
                }}
                style={{ background: 'var(--secondary)', border: '1px solid var(--border)', marginTop: '2rem' }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {error && <div className="status error">{error}</div>}
        {status && !error && !vaultAddress && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
