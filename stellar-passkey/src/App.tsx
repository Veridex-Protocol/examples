import { useCallback, useEffect, useState } from 'react';
import { PasskeyManager } from '@veridex/sdk/passkey';
import {
  StellarNetworks,
  VERIDEX_PASSKEY_ID,
  VeridexStellarWalletModule,
} from '@veridex/sdk/chains/stellar';
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';

/**
 * Veridex × Stellar Passkey demo.
 *
 * Flow:
 *   1. User registers (or reconnects) a Veridex passkey via `PasskeyManager`.
 *   2. A `VeridexStellarWalletModule` is plugged into `StellarWalletsKit`
 *      alongside every other Stellar wallet.
 *   3. The kit's standard surface (`getAddress`, `signTransaction`,
 *      `signAuthEntry`, `signMessage`) routes through Veridex's signer
 *      whenever the Veridex module is selected.
 *
 * This is the credibility artifact referenced in SCF #43 (Passkey UI track).
 */
export function App() {
  const [passkey] = useState(() => new PasskeyManager({ rpName: 'Veridex × Stellar' }));
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const veridex = new VeridexStellarWalletModule({
      passkey,
      config: { network: StellarNetworks.TESTNET },
    });
    const k = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: VERIDEX_PASSKEY_ID,
      modules: [...allowAllModules(), veridex as any],
    });
    setKit(k);
  }, [passkey]);

  const handleRegister = useCallback(async () => {
    setError(null);
    setStatus('Registering passkey…');
    try {
      const cred = await passkey.register('alice', 'Stellar Demo');
      passkey.saveToLocalStorage();
      setStatus(`Registered: ${cred.keyHash.slice(0, 14)}…`);
    } catch (e: any) {
      setError(e.message);
      setStatus('');
    }
  }, [passkey]);

  const handleGetAddress = useCallback(async () => {
    if (!kit) return;
    setError(null);
    setStatus('Deriving smart-account address…');
    try {
      const { address: addr } = await kit.getAddress();
      setAddress(addr);
      setStatus(`Address: ${addr.slice(0, 14)}…`);
    } catch (e: any) {
      setError(e.message);
      setStatus('');
    }
  }, [kit]);

  const handleSignMessage = useCallback(async () => {
    if (!kit) return;
    setError(null);
    setStatus('Awaiting passkey signature…');
    try {
      const { signedMessage } = await kit.signMessage(
        'hello from Veridex × Stellar',
      );
      setStatus(`Signed (${signedMessage.length} chars)`);
    } catch (e: any) {
      setError(e.message);
      setStatus('');
    }
  }, [kit]);

  return (
    <main style={styles.card}>
      <h1 style={styles.title}>Veridex × Stellar Passkey Demo</h1>
      <p style={styles.subtitle}>
        WebAuthn passkey → Soroban smart account, surfaced as a first-class
        wallet inside <code>@creit.tech/stellar-wallets-kit</code>.
      </p>

      <div style={styles.row}>
        <button onClick={handleRegister} style={styles.btn}>
          1. Register passkey
        </button>
        <button onClick={handleGetAddress} style={styles.btn}>
          2. Get smart-account address
        </button>
        <button onClick={handleSignMessage} style={styles.btn}>
          3. Sign a message
        </button>
      </div>

      {address && (
        <div style={styles.field}>
          <span style={styles.label}>Smart-account id</span>
          <code style={styles.code}>{address}</code>
        </div>
      )}

      {status && <div style={styles.status}>{status}</div>}
      {error && <div style={styles.error}>{error}</div>}
    </main>
  );
}

const styles = {
  card: {
    maxWidth: 720,
    margin: '64px auto',
    padding: 32,
    borderRadius: 16,
    fontFamily: 'system-ui, sans-serif',
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
    background: '#fff',
  },
  title: { margin: 0, fontSize: 28 },
  subtitle: { color: '#555' },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginTop: 24 },
  btn: {
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid #ccc',
    background: '#f8f8f8',
    cursor: 'pointer',
    fontSize: 14,
  },
  field: { marginTop: 24 },
  label: { display: 'block', fontSize: 12, color: '#666' },
  code: {
    display: 'block',
    padding: 12,
    background: '#0e1014',
    color: '#9ad',
    borderRadius: 8,
    wordBreak: 'break-all' as const,
    marginTop: 4,
  },
  status: { marginTop: 16, fontSize: 14, color: '#333' },
  error: { marginTop: 16, fontSize: 14, color: '#b00' },
};
