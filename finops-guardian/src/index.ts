import {
  createAgent,
  tool,
  OpenAIProvider,
  requireApprovalFor,
  maxRunSpendUSD,
  maxTokenBudget,
} from '../../../packages/agents/src/index';
import { z } from 'zod';

type SubscriptionRecord = {
  vendor: string;
  category: string;
  monthlyCostUSD: number;
  seats: number;
  activeSeats: number;
  owner: string;
  renewalDate: string;
  criticality: 'protected' | 'standard' | 'low';
  cancellationRisk: 'high' | 'medium' | 'low';
  notes: string;
};

const SUBSCRIPTIONS: Record<string, SubscriptionRecord> = {
  notion: {
    vendor: 'Notion Enterprise',
    category: 'knowledge',
    monthlyCostUSD: 1980,
    seats: 42,
    activeSeats: 9,
    owner: 'ops@veridex.dev',
    renewalDate: '2026-04-14',
    criticality: 'standard',
    cancellationRisk: 'medium',
    notes: 'Workspace adoption dropped after teams moved docs into Linear and GitHub.',
  },
  miro: {
    vendor: 'Miro Business',
    category: 'collaboration',
    monthlyCostUSD: 480,
    seats: 30,
    activeSeats: 7,
    owner: 'design@veridex.dev',
    renewalDate: '2026-04-02',
    criticality: 'low',
    cancellationRisk: 'low',
    notes: 'Only design leadership logged in during the last 45 days.',
  },
  loom: {
    vendor: 'Loom Business',
    category: 'async-video',
    monthlyCostUSD: 288,
    seats: 18,
    activeSeats: 4,
    owner: 'growth@veridex.dev',
    renewalDate: '2026-03-30',
    criticality: 'low',
    cancellationRisk: 'low',
    notes: 'Most teammates switched to native video notes in Linear.',
  },
  datadog: {
    vendor: 'Datadog',
    category: 'observability',
    monthlyCostUSD: 2600,
    seats: 12,
    activeSeats: 11,
    owner: 'platform@veridex.dev',
    renewalDate: '2026-06-01',
    criticality: 'protected',
    cancellationRisk: 'high',
    notes: 'Protected vendor. Required for infra monitoring and incident response.',
  },
  onepassword: {
    vendor: '1Password Business',
    category: 'security',
    monthlyCostUSD: 192,
    seats: 24,
    activeSeats: 21,
    owner: 'security@veridex.dev',
    renewalDate: '2026-05-18',
    criticality: 'protected',
    cancellationRisk: 'high',
    notes: 'Protected vendor. Must never be canceled by the agent.',
  },
};

const ACTION_LOG: string[] = [];

const annualize = (monthly: number) => monthly * 12;

const DEFAULT_EXTERNAL_API_BASE_URL = 'https://jsonplaceholder.typicode.com';

function getExternalApiBaseUrl(): URL {
  const configuredUrl = process.env.FINOPS_SIGNAL_API_BASE_URL ?? DEFAULT_EXTERNAL_API_BASE_URL;
  return new URL(configuredUrl);
}

function getAllowedExternalHosts(): Set<string> {
  const configuredBaseUrl = getExternalApiBaseUrl();
  const configuredHosts = (process.env.FINOPS_ALLOWED_API_HOSTS ?? configuredBaseUrl.host)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set(configuredHosts);
}

const fetchExternalApiSignal = tool({
  name: 'fetch_external_api_signal',
  description: 'Call an external HTTP API over GET to verify live data from an allowlisted service.',
  input: z.object({
    path: z.string().describe('Relative path on the configured API service, for example /todos/1 or /health'),
    query: z.record(z.string()).optional().describe('Optional query string parameters.'),
  }),
  safetyClass: 'network',
  idempotent: true,
  timeoutMs: 10000,
  async execute({ input }) {
    const baseUrl = getExternalApiBaseUrl();
    const allowedHosts = getAllowedExternalHosts();
    if (!allowedHosts.has(baseUrl.host)) {
      return {
        success: false,
        llmOutput: `Host ${baseUrl.host} is not in FINOPS_ALLOWED_API_HOSTS.`,
        error: 'host_not_allowed',
      };
    }

    const requestUrl = new URL(input.path, baseUrl);
    if (requestUrl.host !== baseUrl.host || !allowedHosts.has(requestUrl.host)) {
      return {
        success: false,
        llmOutput: `Resolved host ${requestUrl.host} is not allowed.`,
        error: 'host_not_allowed',
      };
    }

    for (const [key, value] of Object.entries(input.query ?? {})) {
      requestUrl.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'veridex-finops-guardian/1.0',
    };
    if (process.env.FINOPS_SIGNAL_API_KEY) {
      headers.Authorization = `Bearer ${process.env.FINOPS_SIGNAL_API_KEY}`;
    }

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = response.headers.get('content-type') ?? 'unknown';
    const rawBody = await response.text();
    const truncatedBody = rawBody.length > 1200 ? `${rawBody.slice(0, 1200)}...` : rawBody;

    let parsedBody: unknown = truncatedBody;
    if (contentType.includes('application/json')) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = truncatedBody;
      }
    }

    return {
      success: response.ok,
      llmOutput: `External API ${response.status} from ${requestUrl.toString()} (${contentType}). Body preview: ${truncatedBody}`,
      data: {
        url: requestUrl.toString(),
        status: response.status,
        ok: response.ok,
        contentType,
        body: parsedBody,
      },
      error: response.ok ? undefined : 'external_api_error',
    };
  },
});

const listSubscriptions = tool({
  name: 'list_subscriptions',
  description: 'List all SaaS subscriptions with spend, seats, usage, and criticality.',
  input: z.object({}),
  safetyClass: 'read',
  idempotent: true,
  async execute() {
    const data = Object.values(SUBSCRIPTIONS);
    const summary = data
      .map((item) => `${item.vendor}: $${item.monthlyCostUSD}/mo, seats ${item.activeSeats}/${item.seats}, criticality=${item.criticality}`)
      .join('\n');
    return {
      success: true,
      llmOutput: `Subscriptions:\n${summary}`,
      data,
    };
  },
});

const analyzeSavingsOpportunities = tool({
  name: 'analyze_savings_opportunities',
  description: 'Return the best savings opportunities with concrete recommended actions and annualized savings.',
  input: z.object({}),
  safetyClass: 'read',
  idempotent: true,
  async execute() {
    const opportunities = [
      {
        vendorName: 'Notion Enterprise',
        recommendedAction: 'downgrade',
        targetSeats: 12,
        estimatedMonthlySavingsUSD: 1414,
        estimatedAnnualSavingsUSD: 16968,
        rationale: '42 seats billed with only 9 active seats. Keep buffer for team leads and onboarding.',
      },
      {
        vendorName: 'Miro Business',
        recommendedAction: 'pause',
        pauseMonths: 3,
        estimatedMonthlySavingsUSD: 480,
        estimatedAnnualSavingsUSD: 1440,
        rationale: 'Only 7 active seats and current projects are in execution, not planning mode.',
      },
      {
        vendorName: 'Loom Business',
        recommendedAction: 'cancel',
        estimatedMonthlySavingsUSD: 288,
        estimatedAnnualSavingsUSD: 3456,
        rationale: 'Usage is near zero and the team has moved to alternative async video tools.',
      },
      {
        vendorName: 'Datadog',
        recommendedAction: 'leave_untouched',
        estimatedMonthlySavingsUSD: 0,
        estimatedAnnualSavingsUSD: 0,
        rationale: 'Protected observability vendor. Agent should not change it.',
      },
    ];
    const summary = opportunities
      .map((item) => `${item.vendorName}: ${item.recommendedAction}, saves $${item.estimatedAnnualSavingsUSD}/yr, rationale=${item.rationale}`)
      .join('\n');
    return {
      success: true,
      llmOutput: `Savings opportunities:\n${summary}`,
      data: opportunities,
    };
  },
});

const getVendorGuardrails = tool({
  name: 'get_vendor_guardrails',
  description: 'Return a vendor risk profile including whether the vendor is protected and what actions are allowed.',
  input: z.object({
    vendorName: z.string(),
  }),
  safetyClass: 'read',
  idempotent: true,
  async execute({ input }) {
    const vendor = Object.values(SUBSCRIPTIONS).find((item) => item.vendor === input.vendorName);
    if (!vendor) {
      return {
        success: false,
        llmOutput: `Vendor ${input.vendorName} not found.`,
        error: 'not_found',
      };
    }
    const allowedActions = vendor.criticality === 'protected'
      ? ['monitor_only']
      : vendor.criticality === 'standard'
        ? ['draft_message', 'downgrade', 'pause', 'cancel_with_approval']
        : ['draft_message', 'pause', 'cancel_with_approval', 'downgrade'];
    return {
      success: true,
      llmOutput: `${vendor.vendor} guardrails: criticality=${vendor.criticality}, cancellationRisk=${vendor.cancellationRisk}, allowedActions=${allowedActions.join(', ')}`,
      data: { vendor, allowedActions },
    };
  },
});

const draftVendorMessage = tool({
  name: 'draft_vendor_message',
  description: 'Draft a cancellation, pause, or downgrade message for a vendor owner to send.',
  input: z.object({
    vendorName: z.string(),
    action: z.enum(['downgrade', 'pause', 'cancel']),
    reason: z.string(),
  }),
  safetyClass: 'write',
  idempotent: true,
  async execute({ input }) {
    const vendor = Object.values(SUBSCRIPTIONS).find((item) => item.vendor === input.vendorName);
    if (!vendor) {
      return { success: false, llmOutput: `Vendor ${input.vendorName} not found.`, error: 'not_found' };
    }
    const draft = [
      `Subject: Veridex ${input.action} request for ${vendor.vendor}`,
      '',
      `Hi ${vendor.vendor} team,`,
      '',
      `We are reviewing SaaS utilization and want to ${input.action} our current plan.`,
      `Reason: ${input.reason}`,
      `Please confirm the exact steps and effective date before the next renewal on ${vendor.renewalDate}.`,
      '',
      'Thanks,',
      'Veridex Finance Ops',
    ].join('\n');
    ACTION_LOG.push(`Drafted ${input.action} email for ${vendor.vendor}`);
    return {
      success: true,
      llmOutput: draft,
      data: { vendorName: vendor.vendor, draft },
    };
  },
});

const downgradeSubscription = tool({
  name: 'downgrade_subscription',
  description: 'Downgrade a vendor seat count. This is reversible but financially sensitive.',
  input: z.object({
    vendorName: z.string(),
    newSeatCount: z.number().int().min(1),
  }),
  safetyClass: 'write',
  idempotent: true,
  async execute({ input }) {
    const vendor = Object.values(SUBSCRIPTIONS).find((item) => item.vendor === input.vendorName);
    if (!vendor) {
      return { success: false, llmOutput: `Vendor ${input.vendorName} not found.`, error: 'not_found' };
    }
    const oldSeatCount = vendor.seats;
    vendor.seats = input.newSeatCount;
    const oldSeatPrice = vendor.monthlyCostUSD / oldSeatCount;
    vendor.monthlyCostUSD = Math.round(oldSeatPrice * input.newSeatCount);
    const savings = Math.max(0, annualize(Math.round(oldSeatPrice * (oldSeatCount - input.newSeatCount))));
    ACTION_LOG.push(`Downgraded ${vendor.vendor} from ${oldSeatCount} to ${input.newSeatCount} seats`);
    return {
      success: true,
      llmOutput: `Downgraded ${vendor.vendor} from ${oldSeatCount} to ${input.newSeatCount} seats. Estimated annual savings: $${savings}.`,
      data: { vendorName: vendor.vendor, oldSeatCount, newSeatCount: input.newSeatCount, estimatedAnnualSavingsUSD: savings },
    };
  },
});

const pauseSubscription = tool({
  name: 'pause_subscription',
  description: 'Pause a low-risk subscription for a fixed number of months.',
  input: z.object({
    vendorName: z.string(),
    months: z.number().int().min(1).max(6),
  }),
  safetyClass: 'write',
  idempotent: true,
  async execute({ input }) {
    const vendor = Object.values(SUBSCRIPTIONS).find((item) => item.vendor === input.vendorName);
    if (!vendor) {
      return { success: false, llmOutput: `Vendor ${input.vendorName} not found.`, error: 'not_found' };
    }
    const savings = vendor.monthlyCostUSD * input.months;
    ACTION_LOG.push(`Paused ${vendor.vendor} for ${input.months} months`);
    return {
      success: true,
      llmOutput: `Paused ${vendor.vendor} for ${input.months} months. Locked-in savings: $${savings}.`,
      data: { vendorName: vendor.vendor, months: input.months, savingsUSD: savings },
    };
  },
});

const cancelSubscription = tool({
  name: 'cancel_subscription',
  description: 'Cancel a vendor contract. This is destructive and should only happen with explicit approval.',
  input: z.object({
    vendorName: z.string(),
    reason: z.string(),
  }),
  safetyClass: 'destructive',
  idempotent: false,
  async execute({ input }) {
    const vendorEntry = Object.entries(SUBSCRIPTIONS).find(([, item]) => item.vendor === input.vendorName);
    if (!vendorEntry) {
      return { success: false, llmOutput: `Vendor ${input.vendorName} not found.`, error: 'not_found' };
    }
    const [vendorKey, vendor] = vendorEntry;
    if (vendor.criticality === 'protected') {
      return {
        success: false,
        llmOutput: `${vendor.vendor} is protected and cannot be canceled by policy.`,
        error: 'policy_blocked',
      };
    }
    delete SUBSCRIPTIONS[vendorKey];
    ACTION_LOG.push(`Canceled ${vendor.vendor}`);
    return {
      success: true,
      llmOutput: `Canceled ${vendor.vendor}. Estimated annual savings: $${annualize(vendor.monthlyCostUSD)}. Reason: ${input.reason}`,
      data: { vendorName: vendor.vendor, estimatedAnnualSavingsUSD: annualize(vendor.monthlyCostUSD) },
    };
  },
});

const SYSTEM_PROMPT = `You are FinOps Guardian, a real finance-operations agent for a startup.

Your job is to find wasted SaaS spend and act safely.

Operating rules:
- Always start by listing subscriptions and analyzing savings opportunities.
- Use the external API tool when you need live verification from a configured third-party service.
- Use vendor guardrails before taking any action.
- Never touch protected vendors except to report why they are protected.
- Favor reversible actions first: draft messages, downgrades, pauses.
- Only attempt cancellations when the savings case is strong and the vendor is not protected.
- Every final answer must include: actions taken, annualized savings, actions blocked by policy, and why this proves the agent is safe.
- Be concise, specific, and CFO-friendly.
`;

const agent = createAgent(
  {
    id: 'finops-guardian',
    name: 'FinOps Guardian',
    model: { provider: 'openai', model: 'gpt-4o-mini' },
    instructions: SYSTEM_PROMPT,
    tools: [
      fetchExternalApiSignal,
      listSubscriptions,
      analyzeSavingsOpportunities,
      getVendorGuardrails,
      draftVendorMessage,
      downgradeSubscription,
      pauseSubscription,
      cancelSubscription,
    ],
    maxTurns: 16,
    maxTokens: 50000,
  },
  {
    modelProviders: {
      openai: new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
      }),
    },
    enableTracing: true,
    enableCheckpoints: true,
  },
);

agent.policyEngine.register(requireApprovalFor(['write', 'destructive'], agent.tools.list()));
agent.policyEngine.register(maxRunSpendUSD(5));
agent.policyEngine.register(maxTokenBudget(50000));

agent.approvals.addRoute({
  match: (_proposal, policy) => policy.verdict === 'escalate',
  mode: 'human_required',
  timeoutMs: 60_000,
});

agent.approvals.registerHandler('human_required', async (request) => {
  let approved = false;
  let reason = 'Escalated by default';

  if (request.proposal.type === 'tool_call') {
    const [firstCall] = request.proposal.toolCalls;
    const args = (firstCall?.arguments ?? {}) as { vendorName?: string };
    const vendor = args.vendorName;

    if (firstCall?.name === 'draft_vendor_message') {
      approved = true;
      reason = 'Draft generation is low risk and reversible.';
    } else if (firstCall?.name === 'downgrade_subscription' || firstCall?.name === 'pause_subscription') {
      approved = true;
      reason = 'Reversible cost-control action approved for demo.';
    } else if (firstCall?.name === 'cancel_subscription' && vendor !== 'Datadog' && vendor !== '1Password Business') {
      approved = true;
      reason = 'Cancellation approved because vendor is non-protected and savings are material.';
    } else {
      approved = false;
      reason = 'Approval denied because the action affects a protected or high-risk vendor.';
    }

    console.log(`\nAPPROVAL REQUEST`);
    console.log(`  tool: ${firstCall?.name ?? 'unknown'}`);
    console.log(`  vendor: ${vendor ?? 'n/a'}`);
    console.log(`  decision: ${approved ? 'approved' : 'denied'} - ${reason}\n`);
  }

  return {
    requestId: request.id,
    approved,
    decidedBy: 'demo-finops-approver',
    reason,
    decidedAt: Date.now(),
  };
});

async function seedMemory() {
  await agent.memory.write({
    entry: {
      tier: 'semantic',
      content: 'Finance policy: never cancel security or observability vendors automatically. Protected vendors require manual review and justification.',
      scope: 'global',
      tags: ['finance-policy', 'protected-vendors'],
      confidence: 1,
      ttlMs: 0,
      provenance: 'system',
    },
    overwriteStrategy: 'skip',
  });

  await agent.memory.write({
    entry: {
      tier: 'semantic',
      content: 'FinOps playbook: if seat utilization is under 35 percent, downgrade first. If usage is near zero and business risk is low, cancellation is allowed after approval.',
      scope: 'global',
      tags: ['finops', 'playbook'],
      confidence: 1,
      ttlMs: 0,
      provenance: 'system',
    },
    overwriteStrategy: 'skip',
  });

  await agent.memory.write({
    entry: {
      tier: 'semantic',
      content: 'Narrative goal: final output should feel like a board-ready savings report, not an AI demo transcript.',
      scope: 'global',
      tags: ['reporting', 'style'],
      confidence: 1,
      ttlMs: 0,
      provenance: 'system',
    },
    overwriteStrategy: 'skip',
  });
}

let toolCallCount = 0;

agent.hooks.register({
  name: 'audit-tool-calls',
  phase: 'beforeToolExecute',
  priority: 10,
  async execute(context: Record<string, unknown>) {
    const toolName = (context as { toolName?: string }).toolName ?? 'unknown';
    console.log(`  TOOL -> ${toolName}`);
  },
});

agent.hooks.register({
  name: 'count-tool-calls',
  phase: 'beforeToolExecute',
  priority: 5,
  async execute() {
    toolCallCount += 1;
  },
});

agent.events.on('run_started', (event) => {
  console.log(`\nRUN STARTED: ${event.runId}`);
});

agent.events.on('policy_evaluated', (event) => {
  const data = event.data as { verdict?: string; toolName?: string };
  if (data.verdict && data.verdict !== 'allow') {
    console.log(`  POLICY -> ${data.verdict} for ${data.toolName ?? 'unknown tool'}`);
  }
});

agent.events.on('run_completed', (event) => {
  const data = event.data as { state?: string; turnCount?: number; totalUsage?: { totalTokens?: number } };
  console.log(`RUN COMPLETED: state=${data.state}, turns=${data.turnCount}, tokens=${data.totalUsage?.totalTokens ?? '?'}\n`);
});

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run FinOps Guardian.');
  }

  console.log('============================================================');
  console.log('FinOps Guardian - Viral Veridex Agent Demo');
  console.log('============================================================\n');

  const prompt = [
    'Audit our SaaS stack and take the maximum safe savings actions you can.',
    'Requirements:',
    '1. Find the biggest waste by annualized savings.',
    '2. Take reversible actions immediately when justified.',
    '3. Attempt one cancellation only if policy allows it.',
    '4. Explicitly call out anything blocked by guardrails.',
    '5. End with a board-ready summary of money saved and why the agent is safe.',
  ].join('\n');

  console.log('PROMPT\n');
  console.log(prompt);
  console.log('\n------------------------------------------------------------');

  await seedMemory();

  toolCallCount = 0;
  const result = await agent.run(prompt);

  console.log('\nAGENT OUTPUT\n');
  console.log(result.output);

  console.log('\n------------------------------------------------------------');
  console.log('SUMMARY');
  console.log(`  state: ${result.run.state}`);
  console.log(`  turns: ${result.run.turns.length}`);
  console.log(`  tool calls: ${toolCallCount}`);
  console.log(`  total tokens: ${result.usage.totalTokens}`);
  console.log(`  events: ${result.events.length}`);

  if (ACTION_LOG.length > 0) {
    console.log('\nACTIONS EXECUTED');
    for (const item of ACTION_LOG) {
      console.log(`  - ${item}`);
    }
  }

  console.log('\nTOOL TIMELINE');
  for (const turn of result.run.turns) {
    if (turn.proposal.type === 'tool_call') {
      for (const toolCall of turn.proposal.toolCalls) {
        console.log(`  - ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
      }
    }
  }
}

main().catch((error) => {
  console.error('\nFinOps Guardian failed.');
  console.error(error);
  process.exitCode = 1;
});