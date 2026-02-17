import { useState, useEffect, useCallback } from 'react';
import { createSDK } from '@veridex/sdk';
import type { VeridexSDK } from '@veridex/sdk';

interface WalletState {
  credentialId: string;
  keyHash: string;
  vaultAddress: string;
}

const sdk: VeridexSDK = createSDK('base');

export default function App() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  // On mount, check for an existing credential in localStorage
  useEffect(() => {
    try {
      const stored = sdk.passkey.loadFromLocalStorage();
      if (stored) {
        sdk.passkey.setCredential(stored);
        setWallet({
          credentialId: stored.credentialId,
          keyHash: stored.keyHash,
          vaultAddress: sdk.getVaultAddress(),
        });
      }
    } catch {
      // No stored credential — that's fine
    }

    // Check WebAuthn support
    if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
      setSupported(false);
    }
  }, []);

  const createWallet = useCallback(async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Register a new passkey credential
      const credential = await sdk.passkey.register(
        username.trim(),
        username.trim(),
      );

      // Persist to localStorage so it survives page reloads
      sdk.passkey.saveToLocalStorage();

      // Derive the vault address from the credential
      const vaultAddress = sdk.getVaultAddress();

      setWallet({
        credentialId: credential.credentialId,
        keyHash: credential.keyHash,
        vaultAddress,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  }, [username]);

  const reconnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Authenticate using a discoverable passkey (no credential ID needed)
      const { credential } = await sdk.passkey.authenticate();

      // Persist to localStorage
      sdk.passkey.saveToLocalStorage();

      const vaultAddress = sdk.getVaultAddress();

      setWallet({
        credentialId: credential.credentialId,
        keyHash: credential.keyHash,
        vaultAddress,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to reconnect wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Clear the in-memory credential only — keep localStorage intact
    // so that "Reconnect" can find the public key data when the user
    // authenticates with their passkey again.
    sdk.passkey.clearCredential();

    // Reset UI state
    setWallet(null);
    setUsername('');
    setError(null);
  }, []);

  if (!supported) {
    return (
      <div style={styles.card}>
        <h1 style={styles.title}>Veridex Passkey Demo</h1>
        <div style={styles.errorBox}>
          Your browser does not support WebAuthn/Passkeys. Please use a modern
          browser like Chrome, Safari, or Firefox.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.logo}>🔐</div>
        <h1 style={styles.title}>Veridex Passkey Demo</h1>
        <p style={styles.subtitle}>
          Create, reconnect, and disconnect a passkey wallet — the simplest
          Veridex SDK use case.
        </p>
      </div>

      {!wallet ? (
        /* ── Create Wallet View ── */
        <div style={styles.section}>
          <label style={styles.label} htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            placeholder="e.g. alice"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createWallet()}
            disabled={loading}
          />

          <button
            onClick={createWallet}
            disabled={loading}
            style={styles.primaryBtn}
          >
            {loading ? 'Creating…' : 'Create Passkey Wallet'}
          </button>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <span style={styles.dividerLine} />
          </div>

          <button
            onClick={reconnect}
            disabled={loading}
            style={styles.secondaryBtn}
          >
            {loading ? 'Reconnecting…' : 'Reconnect Existing Wallet'}
          </button>

          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.infoBox}>
            <strong>How it works</strong>
            <ol style={styles.list}>
              <li><strong>Create</strong> — Enter a username, authenticate with biometrics, and a new passkey + vault address are created</li>
              <li><strong>Reconnect</strong> — Pick an existing passkey from your device to restore your wallet</li>
            </ol>
          </div>
        </div>
      ) : (
        /* ── Connected Wallet View ── */
        <div style={styles.section}>
          <div style={styles.connectedBadge}>
            <span style={styles.dot} />
            Connected
          </div>

          <div style={styles.field}>
            <span style={styles.fieldLabel}>Vault Address</span>
            <code style={styles.fieldValue}>{wallet.vaultAddress}</code>
          </div>

          <div style={styles.field}>
            <span style={styles.fieldLabel}>Key Hash</span>
            <code style={styles.fieldValue}>{wallet.keyHash}</code>
          </div>

          <div style={styles.field}>
            <span style={styles.fieldLabel}>Credential ID</span>
            <code style={styles.fieldValue}>
              {wallet.credentialId.slice(0, 24)}…
            </code>
          </div>

          <button onClick={disconnect} style={styles.dangerBtn}>
            Disconnect Wallet
          </button>

          <div style={styles.infoBox}>
            <strong>What "Disconnect" does</strong>
            <ul style={styles.list}>
              <li>Clears the active credential from the SDK's memory</li>
              <li>Credential data stays in localStorage so you can reconnect instantly</li>
              <li>The passkey itself remains on your device — tap "Reconnect" to restore</li>
            </ul>
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        Built with{' '}
        <a
          href="https://github.com/Veridex-Protocol/veridex-typescript-sdk"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          @veridex/sdk
        </a>{' '}
        ·{' '}
        <a
          href="https://docs.veridex.network"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          Docs
        </a>
      </footer>
    </div>
  );
}

/* ── Inline styles ── */

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '32px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logo: {
    fontSize: '2.5rem',
    marginBottom: '8px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '6px',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  primaryBtn: {
    background: 'var(--primary)',
    color: '#fff',
  },
  secondaryBtn: {
    background: 'transparent',
    color: 'var(--primary-hover)',
    border: '1px solid var(--border)',
  },
  dangerBtn: {
    background: 'var(--danger)',
    color: '#fff',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border)',
  },
  dividerText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: '#f87171',
  },
  infoBox: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 'var(--radius)',
    padding: '14px 16px',
    fontSize: '0.85rem',
    lineHeight: 1.6,
    color: 'var(--text-muted)',
  },
  list: {
    marginTop: '6px',
    paddingLeft: '18px',
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--success)',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--success)',
  },
  field: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  fieldValue: {
    fontSize: '0.8rem',
    wordBreak: 'break-all',
    color: 'var(--text)',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  link: {
    color: 'var(--primary-hover)',
    textDecoration: 'none',
  },
};
