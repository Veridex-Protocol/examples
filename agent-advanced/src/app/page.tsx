'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
  agentId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export default function Home() {
  // Wallet state
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [username, setUsername] = useState('');

  // Agent state
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [dailyLimit, setDailyLimit] = useState('100');
  const [txLimit, setTxLimit] = useState('25');
  const [enableIdentity, setEnableIdentity] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Shared
  const [loading, setLoading] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Step 1: Create passkey wallet (browser) ──
  const createWallet = useCallback(async () => {
    if (!username.trim()) { setError('Enter a username'); return; }
    setLoading('wallet');
    setError(null);
    try {
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

  // ── Step 2: Provision agent ──
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
            allowedChains: [10004, 10002],
          },
          erc8004: enableIdentity ? { enabled: true, testnet: true, minReputationScore: 20 } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAgentStatus(data);
      setMessages([{
        role: 'system',
        content: `Agent provisioned. Session address: ${data.address}. Daily limit: $${data.dailyLimitUSD}. You can now chat with the AI agent — it has access to wallet tools (pay, balance, status, history).`,
        timestamp: Date.now(),
      }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }, [wallet, dailyLimit, txLimit, enableIdentity]);

  // ── Step 3: Chat with AI agent ──
  const sendChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setLoading('chat');
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, timestamp: Date.now() },
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }, [chatInput]);

  // ── Refresh status ──
  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await res.json();
      if (res.ok) setAgentStatus(data);
    } catch { /* ignore */ }
  }, []);

  // ── Revoke ──
  const revokeSession = useCallback(async () => {
    setLoading('revoke');
    try {
      await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      setAgentStatus(null);
      setMessages([]);
    } catch { /* ignore */ }
    setLoading('');
  }, []);

  return (
    <main style={{ display: 'flex', height: '100vh' }}>
      {/* ── Sidebar ── */}
      <aside style={styles.sidebar}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>🤖 VeriAgent</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20 }}>Advanced Example</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Wallet Section */}
        <div style={styles.sideSection}>
          <h3 style={styles.sideLabel}>Passkey Wallet</h3>
          {!wallet ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createWallet()}
                disabled={loading === 'wallet'}
                style={{ fontSize: '0.8rem', padding: '8px 10px' }}
              />
              <button onClick={createWallet} disabled={loading === 'wallet'} style={styles.smBtn}>
                {loading === 'wallet' ? '…' : 'Create'}
              </button>
            </div>
          ) : (
            <div style={styles.miniFields}>
              <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>● Connected</span>
              <MiniField label="Vault" value={wallet.vaultAddress} />
            </div>
          )}
        </div>

        {/* Agent Section */}
        {wallet && (
          <div style={styles.sideSection}>
            <h3 style={styles.sideLabel}>Agent Session</h3>
            {!agentStatus ? (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.tinyLabel}>Daily $</label>
                    <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} style={styles.smInput} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.tinyLabel}>Per-tx $</label>
                    <input value={txLimit} onChange={(e) => setTxLimit(e.target.value)} style={styles.smInput} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={enableIdentity} onChange={(e) => setEnableIdentity(e.target.checked)} />
                  Enable ERC-8004 Identity
                </label>
                <button onClick={provisionAgent} disabled={loading === 'agent'} style={{ ...styles.smBtn, width: '100%' }}>
                  {loading === 'agent' ? 'Provisioning…' : 'Provision Agent'}
                </button>
              </>
            ) : (
              <div style={styles.miniFields}>
                <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>● Active</span>
                {agentStatus.address && <MiniField label="Address" value={agentStatus.address} />}
                <MiniField label="Budget" value={`$${agentStatus.remainingUSD?.toFixed(2)} / $${agentStatus.dailyLimitUSD}`} />
                <MiniField label="Spent" value={`$${agentStatus.totalSpentUSD?.toFixed(2)}`} />
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={refreshStatus} style={{ ...styles.smBtn, flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    Refresh
                  </button>
                  <button onClick={revokeSession} disabled={loading === 'revoke'} style={{ ...styles.smBtn, flex: 1, background: 'var(--danger)' }}>
                    Revoke
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', paddingTop: 16 }}>
          <a href="https://docs.veridex.network/guides/agent-payments" target="_blank" style={{ color: 'var(--primary-hover)', textDecoration: 'none' }}>Docs</a>
          {' · '}
          <a href="https://github.com/Veridex-Protocol/examples" target="_blank" style={{ color: 'var(--primary-hover)', textDecoration: 'none' }}>GitHub</a>
        </div>
      </aside>

      {/* ── Chat Area ── */}
      <div style={styles.chatArea}>
        {!agentStatus ? (
          <div style={styles.emptyState}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Welcome to VeriAgent</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
              Create a passkey wallet and provision the agent to start chatting.
              The AI can check balances, make payments, and manage your session — all through natural language.
            </p>
            <div style={{ marginTop: 20, padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'left', maxWidth: 400 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Try saying:</p>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8, paddingLeft: 18 }}>
                <li>"What's my balance on Base Sepolia?"</li>
                <li>"Send 1 USDC to 0x742d…5A234 on Base Sepolia"</li>
                <li>"What's my remaining budget?"</li>
                <li>"Show my payment history"</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.messageList}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  ...styles.messageBubble,
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'var(--primary)' : msg.role === 'system' ? 'rgba(99,102,241,0.1)' : 'var(--surface)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  maxWidth: msg.role === 'system' ? '100%' : '75%',
                }}>
                  {msg.role === 'system' && <span style={{ fontSize: '0.7rem', color: 'var(--primary-hover)', fontWeight: 600 }}>SYSTEM</span>}
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6 }}>{msg.content}</div>
                </div>
              ))}
              {loading === 'chat' && (
                <div style={{ ...styles.messageBubble, alignSelf: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Thinking…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={styles.chatInputBar}>
              <textarea
                placeholder="Ask the agent anything…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
                }}
                rows={1}
                style={{ flex: 1 }}
              />
              <button onClick={sendChat} disabled={loading === 'chat' || !chatInput.trim()} style={styles.sendBtn}>
                {loading === 'chat' ? '…' : '→'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function MiniField({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div style={{ marginTop: 2 }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{label}</span>
      <div style={{ fontSize: '0.75rem' }}><code>{value || '—'}</code></div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 280,
    flexShrink: 0,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  sideSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border)',
  },
  sideLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 8,
  },
  tinyLabel: {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 2,
  },
  smBtn: {
    fontSize: '0.8rem',
    padding: '8px 14px',
    background: 'var(--primary)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  smInput: {
    fontSize: '0.8rem',
    padding: '6px 8px',
  },
  miniFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 40,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  messageBubble: {
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
  },
  chatInputBar: {
    display: 'flex',
    gap: 10,
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--primary)',
    color: '#fff',
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: 'none',
    cursor: 'pointer',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
    fontSize: '0.75rem',
    color: '#f87171',
    marginBottom: 12,
  },
};
