import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent-wallet';
import { GeminiAgent } from '@/lib/gemini-agent';

// Singleton Gemini agent — recreated when the wallet changes
let geminiAgent: GeminiAgent | null = null;
let lastAgentAddress: string | null = null;

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const agent = getAgent();
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not provisioned. Create a passkey wallet and provision the agent first.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY not set. Add it to .env.local to enable AI chat.' },
        { status: 500 }
      );
    }

    // Recreate Gemini agent if the underlying wallet changed
    const currentAddress = agent.getSessionStatus().address;
    if (!geminiAgent || currentAddress !== lastAgentAddress) {
      geminiAgent = new GeminiAgent(apiKey, agent);
      await geminiAgent.initialize();
      lastAgentAddress = currentAddress || null;
    }

    const response = await geminiAgent.sendMessage(message);

    return NextResponse.json({ response });
  } catch (err: any) {
    console.error('[chat] Error:', err);
    return NextResponse.json({ error: err.message || 'Chat failed' }, { status: 500 });
  }
}
