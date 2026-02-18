import { NextRequest, NextResponse } from 'next/server';
import { provisionAgent, getAgent, revokeAgent } from '@/lib/agent-wallet';

/**
 * POST /api/agent
 *
 * Actions: provision, status, balance, pay, revoke
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'provision': {
        const { credential, session, erc8004 } = body;

        if (!credential?.credentialId || !credential?.publicKeyX || !credential?.publicKeyY) {
          return NextResponse.json(
            { error: 'Missing passkey credential fields' },
            { status: 400 }
          );
        }

        const agent = await provisionAgent({ credential, session, erc8004 });
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

      case 'status': {
        const agent = getAgent();
        if (!agent) return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 });
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

      case 'balance': {
        const agent = getAgent();
        if (!agent) return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 });
        const tokens = await agent.getBalance(body.chain || 10004);
        return NextResponse.json({
          chain: body.chain || 10004,
          tokens: JSON.parse(JSON.stringify(tokens, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          )),
        });
      }

      case 'pay': {
        const agent = getAgent();
        if (!agent) return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 });

        const { recipient, amount: rawAmount, token, chain } = body;
        if (!recipient || !rawAmount) {
          return NextResponse.json({ error: 'Missing recipient or amount' }, { status: 400 });
        }

        const tokenUpper = (token || 'USDC').toUpperCase();
        const decimals = ['USDC', 'USDT'].includes(tokenUpper) ? 6 : 18;
        const atomicAmount = BigInt(Math.floor(parseFloat(rawAmount) * 10 ** decimals)).toString();

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

      case 'revoke': {
        await revokeAgent();
        return NextResponse.json({ revoked: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[agent-advanced] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
