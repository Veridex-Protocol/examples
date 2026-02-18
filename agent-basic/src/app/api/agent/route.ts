import { NextRequest, NextResponse } from 'next/server';
import { createAgentWallet, AgentWallet } from '@veridex/agentic-payments';

// Singleton agent wallet — created once, reused across requests
let agent: AgentWallet | null = null;

/**
 * POST /api/agent
 *
 * Actions:
 *   provision — Create an AgentWallet from a passkey credential
 *   status    — Get current session status
 *   balance   — Check token balance on a chain
 *   pay       — Execute a USDC payment
 *   revoke    — Revoke the session key
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── Provision: create agent from passkey credential ──
      case 'provision': {
        const { credential, session } = body;

        if (!credential?.credentialId || !credential?.publicKeyX || !credential?.publicKeyY) {
          return NextResponse.json(
            { error: 'Missing passkey credential fields (credentialId, publicKeyX, publicKeyY, keyHash)' },
            { status: 400 }
          );
        }

        agent = await createAgentWallet({
          masterCredential: {
            credentialId: credential.credentialId,
            publicKeyX: BigInt(credential.publicKeyX),
            publicKeyY: BigInt(credential.publicKeyY),
            keyHash: credential.keyHash || '0x0',
          },
          session: {
            dailyLimitUSD: session?.dailyLimitUSD ?? 50,
            perTransactionLimitUSD: session?.perTransactionLimitUSD ?? 10,
            expiryHours: session?.expiryHours ?? 24,
            allowedChains: session?.allowedChains ?? [10004],
          },
          mcp: { enabled: true },
        });

        const status = agent.getSessionStatus();

        return NextResponse.json({
          ready: true,
          address: status.address,
          dailyLimitUSD: status.limits?.dailyLimitUSD,
          remainingUSD: status.remainingDailyLimitUSD,
          totalSpentUSD: status.totalSpentUSD,
          expiry: status.expiry,
        });
      }

      // ── Status: get current session info ──
      case 'status': {
        if (!agent) {
          return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 });
        }
        const status = agent.getSessionStatus();
        return NextResponse.json({
          ready: status.isValid,
          address: status.address,
          dailyLimitUSD: status.limits?.dailyLimitUSD,
          remainingUSD: status.remainingDailyLimitUSD,
          totalSpentUSD: status.totalSpentUSD,
          expiry: status.expiry,
        });
      }

      // ── Balance: check tokens on a chain ──
      case 'balance': {
        if (!agent) {
          return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 });
        }
        const tokens = await agent.getBalance(body.chain || 10004);
        return NextResponse.json({
          chain: body.chain || 10004,
          tokens: JSON.parse(JSON.stringify(tokens, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          )),
        });
      }

      // ── Pay: send USDC to a recipient ──
      case 'pay': {
        if (!agent) {
          return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 });
        }

        const { recipient, amount: rawAmount, token, chain } = body;

        if (!recipient || !rawAmount) {
          return NextResponse.json({ error: 'Missing recipient or amount' }, { status: 400 });
        }

        // Convert human-readable amount to atomic units
        // USDC = 6 decimals, ETH = 18 decimals
        const tokenUpper = (token || 'USDC').toUpperCase();
        const decimals = ['USDC', 'USDT'].includes(tokenUpper) ? 6 : 18;
        const atomicAmount = BigInt(
          Math.floor(parseFloat(rawAmount) * 10 ** decimals)
        ).toString();

        const receipt = await agent.pay({
          chain: chain || 10004,
          token: tokenUpper,
          amount: atomicAmount,
          recipient,
        });

        return NextResponse.json({
          txHash: receipt.txHash,
          status: receipt.status,
          amount: rawAmount,
          token: tokenUpper,
          chain: chain || 10004,
        });
      }

      // ── Revoke: destroy the session key ──
      case 'revoke': {
        if (!agent) {
          return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 });
        }
        await agent.revokeSession();
        agent = null;
        return NextResponse.json({ revoked: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[agent-basic] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
