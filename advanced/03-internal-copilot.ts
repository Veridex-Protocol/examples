/**
 * Reference Example 1: Internal Copilot with Governed Workspace State
 *
 * Demonstrates a non-payment agent that uses:
 * - Governed workspace state (WorkspaceStateProvider for external resource reads)
 * - Policy-driven context assembly (ContextRetrievalPolicy)
 * - Memory with typed entries (note, workspace_state, derived_memory, evidence)
 * - Security policy packs (injection detection, tool poisoning)
 * - Eval scenario runner for regression validation
 *
 * This example models an internal engineering copilot that reads project
 * state from a workspace (issues, deployments, configs) and answers
 * questions with full provenance tracking and policy governance.
 */

import { z } from 'zod';
import {
  createAgent,
  tool,
  PolicyEngine,
  ContextCompiler,
  MemoryManager,
  SecurityPolicyPackManager,
  HookRegistry,
  injectionDetectionPack,
  toolPoisoningPack,
  WorkspaceStateAdapter,
  runEvalSuite,
  policyPassthroughScenario,
  contextNoBudgetPressureScenario,
  contextPriorityOrderingScenario,
  memoryWriteSearchScenario,
  injectionCleanPassScenario,
  DEFAULT_RETRIEVAL_POLICY,
} from '@veridex/agents';
import type {
  WorkspaceStateProvider,
  WorkspaceResourceSnapshot,
  EvidenceSnapshot,
  WorkspaceStateMutation,
  WorkspaceStateMutationResult,
} from '@veridex/agents';

// ── Workspace State Provider (in-memory mock) ──

/**
 * Simulates reading governed workspace resources from an external
 * authority (e.g. control-plane service, JIRA, GitHub, or a database).
 *
 * In production this would be backed by ControlPlaneService or an HTTP client.
 */
class ProjectWorkspaceProvider implements WorkspaceStateProvider {
  private resources: WorkspaceResourceSnapshot[] = [
    {
      ref: {
        resourceType: 'deployment',
        resourceId: 'deploy-api-v2.3.1',
        workspaceId: 'eng-workspace',
        version: '2.3.1',
      },
      summary: 'API v2.3.1 deployed to production on 2026-04-01. Status: healthy. 99.97% uptime.',
      asOf: '2026-04-01T14:30:00Z',
      data: { service: 'api', version: '2.3.1', environment: 'production', status: 'healthy' },
    },
    {
      ref: {
        resourceType: 'deployment',
        resourceId: 'deploy-web-v3.0.0',
        workspaceId: 'eng-workspace',
        version: '3.0.0',
      },
      summary: 'Web app v3.0.0 deployed to staging on 2026-04-03. Status: testing. Pending QA sign-off.',
      asOf: '2026-04-03T09:15:00Z',
      data: { service: 'web', version: '3.0.0', environment: 'staging', status: 'testing' },
    },
    {
      ref: {
        resourceType: 'issue',
        resourceId: 'PROJ-1042',
        workspaceId: 'eng-workspace',
      },
      summary: 'PROJ-1042: Memory leak in WebSocket handler. Severity: high. Assigned: @alice. Status: in-progress.',
      asOf: '2026-04-02T11:00:00Z',
      data: { severity: 'high', assignee: 'alice', status: 'in-progress' },
    },
    {
      ref: {
        resourceType: 'config',
        resourceId: 'rate-limits',
        workspaceId: 'eng-workspace',
        version: '7',
      },
      summary: 'Rate limits config v7: 100 req/min for free tier, 1000 req/min for pro, 10000 req/min for enterprise.',
      asOf: '2026-03-28T10:00:00Z',
      data: { free: 100, pro: 1000, enterprise: 10000 },
    },
  ];

  async getResources(query?: { resourceTypes?: string[] }): Promise<WorkspaceResourceSnapshot[]> {
    if (query?.resourceTypes) {
      return this.resources.filter((r) => query.resourceTypes!.includes(r.ref.resourceType));
    }
    return this.resources;
  }

  async getEvidence(): Promise<EvidenceSnapshot[]> {
    return [
      {
        ref: {
          traceId: 'trace-deploy-api-2.3.1',
          bundleId: 'bundle-2026-04-01',
        },
        summary: 'Deployment trace for API v2.3.1: all health checks passed, zero rollback triggers.',
      },
    ];
  }

  async proposeMutation(mutation: WorkspaceStateMutation): Promise<WorkspaceStateMutationResult> {
    console.log(`  [Workspace] Mutation proposed: ${mutation.operation} on ${mutation.ref.resourceId}`);
    console.log(`  [Workspace] Reason: ${mutation.reason}`);
    // In production, this validates against access control and persists
    return { accepted: true };
  }
}

// ── Tool Definitions ──

const listDeployments = tool({
  name: 'list_deployments',
  description: 'List current deployment status across environments.',
  input: z.object({
    environment: z.string().optional().describe('Filter by environment (production, staging, dev)'),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    // In a real implementation, this reads from the workspace state adapter
    const deployments = [
      { service: 'api', version: '2.3.1', env: 'production', status: 'healthy' },
      { service: 'web', version: '3.0.0', env: 'staging', status: 'testing' },
      { service: 'worker', version: '1.8.0', env: 'production', status: 'healthy' },
    ];

    const filtered = input.environment
      ? deployments.filter((d) => d.env === input.environment)
      : deployments;

    const summary = filtered
      .map((d) => `${d.service} v${d.version} (${d.env}): ${d.status}`)
      .join('\n');

    return {
      llmOutput: summary || 'No deployments found.',
      success: true,
      data: { deployments: filtered },
    };
  },
});

const searchIssues = tool({
  name: 'search_issues',
  description: 'Search project issues by keyword or severity.',
  input: z.object({
    query: z.string().describe('Search query'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    const issues = [
      { id: 'PROJ-1042', title: 'Memory leak in WebSocket handler', severity: 'high', status: 'in-progress' },
      { id: 'PROJ-1039', title: 'Optimize batch processing query', severity: 'medium', status: 'open' },
      { id: 'PROJ-1045', title: 'Add rate limit headers to API responses', severity: 'low', status: 'open' },
    ];

    const filtered = issues.filter((i) => {
      const matchQuery = i.title.toLowerCase().includes(input.query.toLowerCase());
      const matchSeverity = !input.severity || i.severity === input.severity;
      return matchQuery && matchSeverity;
    });

    const summary = filtered
      .map((i) => `[${i.id}] ${i.title} (${i.severity}, ${i.status})`)
      .join('\n');

    return {
      llmOutput: summary || 'No issues found.',
      success: true,
      data: { issues: filtered },
    };
  },
});

const proposeConfigChange = tool({
  name: 'propose_config_change',
  description: 'Propose a configuration change. Requires approval before applying.',
  input: z.object({
    configId: z.string().describe('Configuration resource ID'),
    change: z.string().describe('Description of the proposed change'),
    reason: z.string().describe('Reason for the change'),
  }),
  safetyClass: 'write',
  async execute({ input }) {
    return {
      llmOutput: `Proposed config change for ${input.configId}: "${input.change}". Reason: ${input.reason}. Awaiting approval.`,
      success: true,
      data: { configId: input.configId, status: 'pending_approval' },
    };
  },
});

// ── Main ──

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' Veridex Reference Example: Internal Engineering Copilot');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Set up workspace state provider
  const workspaceProvider = new ProjectWorkspaceProvider();
  const adapter = new WorkspaceStateAdapter(workspaceProvider);

  console.log('1. Workspace State Provider');
  console.log('   Provider connected:', adapter.isAvailable());
  const resources = await adapter.getResources();
  console.log(`   Resources loaded: ${resources.length}`);
  for (const r of resources) {
    console.log(`   - [${r.ref.resourceType}] ${r.ref.resourceId}: ${r.summary.slice(0, 60)}...`);
  }
  console.log();

  // 2. Set up security policy packs
  const policyEngine = new PolicyEngine();
  const hookRegistry = new HookRegistry();
  const securityManager = new SecurityPolicyPackManager(policyEngine, hookRegistry);

  securityManager.registerPack(injectionDetectionPack());
  securityManager.registerPack(toolPoisoningPack());

  console.log('2. Security Policy Packs');
  console.log(`   Active rules: ${policyEngine.list().length}`);
  console.log(`   Packs: injection-detection, tool-poisoning`);
  console.log();

  // 3. Context assembly with retrieval policy
  const compiler = new ContextCompiler();
  const contextPlan = compiler.compile({
    maxTokens: 4000,
    sections: [
      { id: 'system', source: 'system', content: 'You are an internal engineering copilot for the Veridex team.', priority: 100 },
      { id: 'instructions', source: 'instructions', content: 'Answer questions about deployments, issues, and configs. Always cite your sources.', priority: 95 },
      { id: 'workspace-deployments', source: 'workspace_state', content: resources.filter((r) => r.ref.resourceType === 'deployment').map((r) => r.summary).join('\n'), priority: 80 },
      { id: 'workspace-issues', source: 'workspace_state', content: resources.filter((r) => r.ref.resourceType === 'issue').map((r) => r.summary).join('\n'), priority: 75 },
      { id: 'workspace-configs', source: 'workspace_state', content: resources.filter((r) => r.ref.resourceType === 'config').map((r) => r.summary).join('\n'), priority: 70 },
      { id: 'evidence', source: 'evidence', content: (await adapter.getEvidence()).map((e) => e.summary).join('\n'), priority: 60 },
    ],
  });

  console.log('3. Context Assembly (Retrieval Policy)');
  console.log(`   Total tokens: ${contextPlan.totalTokens} / ${contextPlan.budgetTokens}`);
  console.log(`   Sections: ${contextPlan.sections.length}`);
  console.log(`   Truncated: ${contextPlan.hadTruncation}`);
  for (const s of contextPlan.sections) {
    console.log(`   - [${s.source}] ${s.id}: ${s.actualTokens} tokens${s.wasTruncated ? ' (truncated)' : ''}`);
  }
  console.log();

  // 4. Memory with typed entries
  const memory = new MemoryManager();
  await memory.write({
    entry: {
      content: 'User prefers concise deployment status summaries.',
      tier: 'semantic',
      scope: 'agent',
      kind: 'note',
      provenance: 'user',
      confidence: 0.9,
      ttlMs: 0,
      tags: ['preference'],
    },
    overwriteStrategy: 'skip',
  });

  await memory.write({
    entry: {
      content: 'API v2.3.1 deployment verified healthy via trace-deploy-api-2.3.1.',
      tier: 'semantic',
      scope: 'workspace',
      kind: 'derived_memory',
      provenance: 'system',
      confidence: 1.0,
      ttlMs: 0,
      tags: ['deployment', 'derived'],
      stateRef: {
        resourceType: 'deployment',
        resourceId: 'deploy-api-v2.3.1',
        workspaceId: 'eng-workspace',
        version: '2.3.1',
      },
    },
    overwriteStrategy: 'skip',
  });

  const derivedMemory = await memory.searchByKind('derived_memory');
  console.log('4. Memory (Typed Entries)');
  console.log(`   Notes: ${(await memory.searchByKind('note')).length}`);
  console.log(`   Derived memory: ${derivedMemory.length}`);
  for (const m of derivedMemory) {
    console.log(`   - ${m.content.slice(0, 60)}... [kind=${m.kind}, scope=${m.scope}]`);
  }
  console.log();

  // 5. Create the agent definition
  const agentDef = {
    id: 'eng-copilot',
    name: 'Engineering Copilot',
    model: { provider: 'openai' as const, model: 'gpt-4o' },
    instructions: 'You are an internal engineering copilot. Read workspace state to answer questions about deployments, issues, and configurations. Always cite resource IDs.',
    tools: [listDeployments, searchIssues, proposeConfigChange],
    maxTurns: 10,
    maxTokens: 8000,
  };

  const agent = createAgent(agentDef, {
    workspaceStateProvider: workspaceProvider,
    retrievalPolicy: DEFAULT_RETRIEVAL_POLICY,
  });

  console.log('5. Agent Created');
  console.log(`   ID: ${agentDef.id}`);
  console.log(`   Name: ${agentDef.name}`);
  console.log(`   Tools: ${agentDef.tools.map((t) => t.name).join(', ')}`);
  console.log(`   Max turns: ${agentDef.maxTurns}`);
  console.log();

  // 6. Propose a workspace mutation via the adapter
  const mutationResult = await adapter.proposeMutation({
    ref: {
      resourceType: 'config',
      resourceId: 'rate-limits',
      workspaceId: 'eng-workspace',
      version: '7',
    },
    operation: 'update',
    payload: { free: 150, pro: 1500, enterprise: 15000 },
    reason: 'Increase rate limits by 50% to accommodate growth.',
    proposedBy: 'eng-copilot',
  });

  console.log('6. Workspace Mutation Proposal');
  console.log(`   Accepted: ${mutationResult.accepted}`);
  console.log();

  // 7. Run eval regression suite
  console.log('7. Eval Regression Suite');
  const suiteResult = await runEvalSuite('copilot-regression', 'Copilot Regression', [
    policyPassthroughScenario(),
    contextNoBudgetPressureScenario(),
    contextPriorityOrderingScenario(),
    memoryWriteSearchScenario(),
    injectionCleanPassScenario(),
  ]);

  console.log(`   Suite: ${suiteResult.suiteName}`);
  console.log(`   Status: ${suiteResult.status}`);
  console.log(`   Passed: ${suiteResult.passed}/${suiteResult.total}`);
  console.log(`   Duration: ${suiteResult.durationMs}ms`);
  for (const r of suiteResult.results) {
    const icon = r.status === 'passed' ? '✓' : '✗';
    console.log(`   ${icon} ${r.scenarioName} (${r.durationMs}ms)`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════');
  console.log(' Example complete. All subsystems operational.');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
