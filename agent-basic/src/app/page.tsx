'use client';

import { useState, useCallback } from 'react';
import './globals.css';

interface WalletInfo {
  credentialId: string;
  publicKeyX: string;
  publicKeyY: string;
  keyHash: string;
  vaultAddress: string;
}

interface AgentStatus {
  ready: boolean;
  address?: string;
  dailyLimitUSD?: number;
  remainingUSD?: number;
  totalSpentUSD?: number;
  expiry?: number;
}

interface PaymentResult {
  txHash: string;
  status: string;
  amount: string;
  token: string;
  chain: number;
}

export default function Home() {
  // Step 1: Passkey wallet
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [username, setUsername] = useState('');

  // Step 2: Agent
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [dailyLimit, setDailyLimit] = useState('50');
  const [txLimit, setTxLimit] = useState('10');

  // Step 3: Payments
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  // Shared state
  const [loading, setLoading] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: Create passkey wallet via the SDK (browser-side) ──
  const createWallet = useCallback(async () => {
    if (!username.trim()) { setError('Enter a username'); return; }
    setLoading('wallet');
    setError(null);
    try {
      // Dynamic import — SDK must run in the browser
      const { createSDK } = await import('@veridex/sdk');
      const sdk = createSDK('base');

      const credential = await sdk.passkey.register(username.trim(), username.trim());
      sdk.passkey.saveToLocalStorage();

      setWallet({
        credentialId: credential.credentialId,
        publicKeyX: credential.publicKeyX.toString(),
        publicKeyY: credential.publicKeyY.toString(),
        keyHash: credential.keyHash,
        vaultAddress: sdk.getVaultAddress(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
    } finally {
      setLoading('');
    }
  }, [username]);

  // ── Step 2: Provision agent with passkey credential ──
  const provisionAgent = useCallback(async () => {
    if (!wallet) return;
    setLoading('agent');
    setError(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'provision',
          credential: {
            credentialId: wallet.credentialId,
            publicKeyX: wallet.publicKeyX,
            publicKeyY: wallet.publicKeyY,
            keyHash: wallet.keyHash,
          },
          session: {
            dailyLimitUSD: Number(dailyLimit),
            perTransactionLimitUSD: Number(txLimit),
            expiryHours: 24,
            allowedChains: [10004], // Base Sepolia
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provision failed');
      setAgentStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }, [wallet, dailyLimit, txLimit]);

  // ── Step 3a: Check balance ──
  const checkBalance = useCallback(async () => {
    setLoading('balance');
    setError(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'balance', chain: 10004 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Balance check failed');
      setAgentStatus((prev) => prev ? { ...prev, ...data } : prev);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }, []);

  // ── Step 3b: Make a payment ──
  const makePayment = useCallback(async () => {
    if (!recipient || !amount) { setError('Enter recipient and amount'); return; }
    setLoading('pay');
    setError(null);
    setPaymentResult(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay',
          recipient,
          amount,
          token: 'USDC',
          chain: 10004,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      setPaymentResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }, [recipient, amount]);

  // ── Step 4: Revoke session ──
  const revokeSession = useCallback(async () => {
    setLoading('revoke');
    setError(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setAgentStatus(null);
      setPaymentResult(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }, []);

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <header style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>🤖 Veridex Agent — Basic</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 6 }}>
          Create a passkey wallet, provision an AI agent, and make payments.
        </p>
      </header>

      {error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {/* ── Step 1: Passkey Wallet ── */}
      <section style={styles.card}>
        <h2 style={styles.stepTitle}>
          <span style={styles.badge}>1</span> Create Passkey Wallet
        </h2>
        <p style={styles.hint}>
          The agent SDK requires a passkey credential from <code>@veridex/sdk</code>.
          This runs in the browser using WebAuthn.
        </p>

        {!wallet ? (
          <div style={styles.row}>
            <input
              placeholder="Username (e.g. alice)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createWallet()}
              disabled={loading === 'wallet'}
            />
            <button
              onClick={createWallet}
              disabled={loading === 'wallet'}
              style={styles.primaryBtn}
            >
              {loading === 'wallet' ? 'Creating…' : 'Create'}
            </button>
          </div>
        ) : (
          <div style={styles.fields}>
            <div style={styles.connectedBadge}>
              <span style={styles.dot} /> Wallet Connected
            </div>
            <Field label="Vault Address" value={wallet.vaultAddress} />
            <Field label="Key Hash" value={wallet.keyHash} />
          </div>
        )}
      </section>

      {/* ── Step 2: Provision Agent ── */}
      {wallet && (
        <section style={styles.card}>
          <h2 style={styles.stepTitle}>
            <span style={styles.badge}>2</span> Provision Agent
          </h2>
          <p style={styles.hint}>
            Send the passkey credential to the backend to create an <code>AgentWallet</code> with
            session keys and spending limits.
          </p>

          {!agentStatus ? (
            <>
              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Daily limit ($)</label>
                  <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Per-tx limit ($)</label>
                  <input value={txLimit} onChange={(e) => setTxLimit(e.target.value)} />
                </div>
              </div>
              <button
                onClick={provisionAgent}
                disabled={loading === 'agent'}
                style={styles.primaryBtn}
              >
                {loading === 'agent' ? 'Provisioning…' : 'Provision Agent'}
              </button>
            </>
          ) : (
            <div style={styles.fields}>
              <div style={styles.connectedBadge}>
                <span style={styles.dot} /> Agent Active
              </div>
              {agentStatus.address && <Field label="Session Address" value={agentStatus.address} />}
              <Field label="Daily Limit" value={`$${agentStatus.dailyLimitUSD}`} />
              <Field label="Remaining" value={`$${agentStatus.remainingUSD?.toFixed(2)}`} />
              <Field label="Spent Today" value={`$${agentStatus.totalSpentUSD?.toFixed(2)}`} />
              <button onClick={revokeSession} disabled={!!loading} style={styles.dangerBtn}>
                {loading === 'revoke' ? 'Revoking…' : 'Revoke Session'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Step 3: Use Agent ── */}
      {agentStatus && (
        <section style={styles.card}>
          <h2 style={styles.stepTitle}>
            <span style={styles.badge}>3</span> Use Agent
          </h2>

          <button
            onClick={checkBalance}
            disabled={loading === 'balance'}
            style={styles.secondaryBtn}
          >
            {loading === 'balance' ? 'Checking…' : 'Check Balance (Base Sepolia)'}
          </button>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
            <label style={styles.label}>Send USDC Payment</label>
            <input
              placeholder="Recipient address (0x…)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={styles.row}>
              <input
                placeholder="Amount (e.g. 1.00)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                onClick={makePayment}
                disabled={loading === 'pay'}
                style={styles.primaryBtn}
              >
                {loading === 'pay' ? 'Sending…' : 'Pay'}
              </button>
            </div>
          </div>

          {paymentResult && (
            <div style={styles.successBox}>
              <strong>Payment Confirmed</strong>
              <Field label="Tx Hash" value={paymentResult.txHash} />
              <Field label="Amount" value={`${paymentResult.amount} ${paymentResult.token}`} />
            </div>
          )}
        </section>
      )}

      <footer style={{ textAlign: 'center', marginTop: 32, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Built with{' '}
        <a href="https://github.com/Veridex-Protocol/veridex-typescript-sdk" target="_blank" style={{ color: 'var(--primary-hover)', textDecoration: 'none' }}>
          @veridex/sdk
        </a>{' '}
        +{' '}
        <a href="https://docs.veridex.network/guides/agent-payments" target="_blank" style={{ color: 'var(--primary-hover)', textDecoration: 'none' }}>
          @veridex/agentic-payments
        </a>
      </footer>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 14px', marginTop: 6 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <code style={{ color: 'var(--text)' }}>{value || '—'}</code>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  badge: {
    background: 'var(--primary)',
    color: '#fff',
    borderRadius: '50%',
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  hint: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    lineHeight: 1.5,
    marginBottom: 14,
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 4,
  },
  row: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  primaryBtn: {
    background: 'var(--primary)',
    color: '#fff',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  secondaryBtn: {
    background: 'transparent',
    color: 'var(--primary-hover)',
    border: '1px solid var(--border)',
    width: '100%',
  },
  dangerBtn: {
    background: 'var(--danger)',
    color: '#fff',
    width: '100%',
    marginTop: 8,
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--success)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--success)',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: '#f87171',
    marginBottom: 16,
  },
  successBox: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 'var(--radius)',
    padding: '14px 16px',
    marginTop: 12,
  },
};
