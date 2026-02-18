import { createAgentWallet, AgentWallet } from '@veridex/agentic-payments';

// Singleton agent wallet
let agent: AgentWallet | null = null;

export interface ProvisionParams {
  credential: {
    credentialId: string;
    publicKeyX: string;
    publicKeyY: string;
    keyHash: string;
  };
  session: {
    dailyLimitUSD: number;
    perTransactionLimitUSD: number;
    expiryHours: number;
    allowedChains: number[];
  };
  erc8004?: {
    enabled: boolean;
    testnet: boolean;
    minReputationScore?: number;
  };
}

export async function provisionAgent(params: ProvisionParams): Promise<AgentWallet> {
  agent = await createAgentWallet({
    masterCredential: {
      credentialId: params.credential.credentialId,
      publicKeyX: BigInt(params.credential.publicKeyX),
      publicKeyY: BigInt(params.credential.publicKeyY),
      keyHash: params.credential.keyHash || '0x0',
    },
    session: params.session,
    relayerUrl: process.env.VERIDEX_RELAYER_URL,
    mcp: { enabled: true },
    erc8004: params.erc8004 as any,
  } as any);

  return agent;
}

export function getAgent(): AgentWallet | null {
  return agent;
}

export async function revokeAgent(): Promise<void> {
  if (agent) {
    await agent.revokeSession();
    agent = null;
  }
}
