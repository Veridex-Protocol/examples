/**
 * Reference Example 2: Multi-Agent Operator Workflow
 *
 * Demonstrates a multi-agent team using:
 * - Orchestrator with dependency-aware task graph
 * - Capability-match scheduling across a team
 * - Shared memory between agents (dependency results)
 * - Policy enforcement on every agent (injection detection)
 * - Approval escalation for write operations
 * - Structured progress events
 * - Eval regression for policy + handoff scenarios
 *
 * This example models an incident response workflow where:
 *   1. A triage agent assesses the incident
 *   2. A diagnostics agent (depends on triage) investigates root cause
 *   3. A remediation agent (depends on diagnostics) proposes a fix
 *   4. A comms agent (depends on triage) drafts stakeholder updates
 *
 * Triage and comms run in parallel with diagnostics; remediation waits
 * for diagnostics to complete.
 */

import { z } from 'zod';
import {
  tool,
  Orchestrator,
  PolicyEngine,
  SecurityPolicyPackManager,
  HookRegistry,
  injectionDetectionPack,
  handoffSafetyPack,
  runEvalSuite,
  policyPassthroughScenario,
  handoffAllowedScenario,
  handoffBlockedScenario,
  circuitBreakerStaysClosedScenario,
  injectionDetectionScenario,
} from '@veridex/agents';
import type {
  AgentDefinition,
  TeamMember,
  OrchestratorEvent,
  OrchestratorResult,
  RunResult,
} from '@veridex/agents';

// ── Tool Definitions ──

const assessIncident = tool({
  name: 'assess_incident',
  description: 'Analyze an incident report and produce a severity assessment.',
  input: z.object({
    incidentId: z.string(),
    description: z.string(),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    return {
      llmOutput: `Incident ${input.incidentId} assessed: severity=high, impact=api-latency, affected=production-api. Root cause investigation needed.`,
      success: true,
      data: { severity: 'high', impact: 'api-latency', affected: ['production-api'] },
    };
  },
});

const runDiagnostics = tool({
  name: 'run_diagnostics',
  description: 'Run diagnostic checks against affected services.',
  input: z.object({
    services: z.array(z.string()),
    checkType: z.enum(['health', 'logs', 'metrics']),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    return {
      llmOutput: `Diagnostics for ${input.services.join(', ')} (${input.checkType}): Found connection pool exhaustion in production-api. Pool max=50, active=50, waiting=230. DB response time p99=4200ms (normal: 50ms).`,
      success: true,
      data: {
        rootCause: 'connection-pool-exhaustion',
        poolMax: 50,
        poolActive: 50,
        poolWaiting: 230,
        dbP99Ms: 4200,
      },
    };
  },
});

const proposeRemediation = tool({
  name: 'propose_remediation',
  description: 'Propose a remediation action. Requires operator approval.',
  input: z.object({
    action: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
    rollbackPlan: z.string(),
  }),
  safetyClass: 'write',
  async execute({ input }) {
    return {
      llmOutput: `Remediation proposed: "${input.action}". Risk: ${input.risk}. Rollback: ${input.rollbackPlan}. Awaiting operator approval.`,
      success: true,
      data: { status: 'pending_approval', action: input.action },
    };
  },
});

const draftComms = tool({
  name: 'draft_comms',
  description: 'Draft a stakeholder communication about the incident.',
  input: z.object({
    audience: z.enum(['internal', 'customer', 'executive']),
    severity: z.string(),
    summary: z.string(),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    return {
      llmOutput: `[${input.audience.toUpperCase()} COMMS] Incident Update: ${input.summary}. Severity: ${input.severity}. Our team is actively investigating and will provide updates every 30 minutes.`,
      success: true,
    };
  },
});

// ── Agent Definitions ──

const triageAgent: AgentDefinition = {
  id: 'triage-agent',
  name: 'Incident Triage',
  model: { provider: 'openai', model: 'gpt-4o' },
  instructions: 'You are an incident triage specialist. Assess incoming incidents for severity, impact, and affected services. Be concise and factual.',
  tools: [assessIncident],
  maxTurns: 3,
};

const diagnosticsAgent: AgentDefinition = {
  id: 'diagnostics-agent',
  name: 'Diagnostics Engineer',
  model: { provider: 'openai', model: 'gpt-4o' },
  instructions: 'You are a diagnostics engineer. Investigate root causes using health checks, logs, and metrics. Identify the specific failure mode.',
  tools: [runDiagnostics],
  maxTurns: 5,
};

const remediationAgent: AgentDefinition = {
  id: 'remediation-agent',
  name: 'Remediation Specialist',
  model: { provider: 'openai', model: 'gpt-4o' },
  instructions: 'You are a remediation specialist. Based on diagnostic findings, propose a fix with risk assessment and rollback plan. All actions require operator approval.',
  tools: [proposeRemediation],
  maxTurns: 3,
};

const commsAgent: AgentDefinition = {
  id: 'comms-agent',
  name: 'Communications',
  model: { provider: 'openai', model: 'gpt-4o' },
  instructions: 'You draft incident communications for different audiences. Be clear, professional, and avoid technical jargon for customer-facing comms.',
  tools: [draftComms],
  maxTurns: 3,
};

// ── Team Configuration ──

const team: TeamMember[] = [
  { definition: triageAgent, capabilities: ['triage', 'assessment'] },
  { definition: diagnosticsAgent, capabilities: ['diagnostics', 'investigation'] },
  { definition: remediationAgent, capabilities: ['remediation', 'write'] },
  { definition: commsAgent, capabilities: ['communications', 'drafting'] },
];

// ── Main ──

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' Veridex Reference Example: Multi-Agent Incident Response');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Set up security policies
  const policyEngine = new PolicyEngine();
  const hookRegistry = new HookRegistry();
  const securityManager = new SecurityPolicyPackManager(policyEngine, hookRegistry);

  securityManager.registerPack(injectionDetectionPack());
  securityManager.registerPack(handoffSafetyPack({
    allowedTargets: ['triage-agent', 'diagnostics-agent', 'remediation-agent', 'comms-agent'],
  }));

  console.log('1. Security Policies');
  console.log(`   Policy rules: ${policyEngine.list().length}`);
  console.log(`   Allowed handoff targets: triage, diagnostics, remediation, comms`);
  console.log();

  // 2. Create orchestrator with test executor
  const progressLog: OrchestratorEvent[] = [];

  // Mock executor for demonstration (in production, uses real model calls)
  const mockExecutor = async (
    member: TeamMember,
    prompt: string,
  ): Promise<RunResult> => {
    // Simulate agent work
    const output = `[${member.definition.name}] Completed: ${prompt.slice(0, 80)}...`;
    return {
      runId: `run-${member.definition.id}-${Date.now()}`,
      agentId: member.definition.id,
      state: 'completed',
      output,
      turns: 1,
      totalUsage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
      durationMs: 150,
      policyDecisions: [],
      approvalDecisions: [],
    };
  };

  const orchestrator = new Orchestrator(
    {
      team: {
        id: 'incident-response',
        name: 'Incident Response Team',
        members: team,
        maxConcurrency: 3,
        sharedMemory: true,
      },
      schedulerStrategy: 'capability-match',
      onProgress: (event) => {
        progressLog.push(event);
        const emoji = {
          task_created: '📋',
          task_assigned: '👤',
          task_started: '▶️',
          task_completed: '✅',
          task_failed: '❌',
          orchestration_started: '🚀',
          orchestration_completed: '🏁',
        }[event.type] ?? '📌';
        console.log(`   ${emoji} ${event.type}${event.taskId ? ` [${event.taskId}]` : ''}`);
      },
    },
    mockExecutor,
  );

  console.log('2. Orchestrator Created');
  console.log(`   Team: ${team.length} agents`);
  console.log(`   Strategy: capability-match`);
  console.log(`   Max concurrency: 3`);
  console.log();

  // 3. Build the task graph
  console.log('3. Task Graph');

  const triageTask = orchestrator.addTask({
    title: 'Triage incident INC-2026-0401',
    description: 'Assess incident INC-2026-0401: API latency spike reported by monitoring. Determine severity, impact, and affected services.',
    priority: 'critical',
    assigneeId: 'triage-agent',
  });

  const diagnosticsTask = orchestrator.addTask({
    title: 'Investigate root cause',
    description: 'Based on triage findings, run diagnostic checks on affected services. Identify the specific failure mode and contributing factors.',
    priority: 'high',
    assigneeId: 'diagnostics-agent',
    dependsOn: [triageTask.id],
  });

  const remediationTask = orchestrator.addTask({
    title: 'Propose remediation',
    description: 'Based on diagnostic findings, propose a remediation with risk assessment and rollback plan. This action requires operator approval.',
    priority: 'high',
    assigneeId: 'remediation-agent',
    dependsOn: [diagnosticsTask.id],
  });

  const commsTask = orchestrator.addTask({
    title: 'Draft stakeholder communications',
    description: 'Draft incident update for internal and customer audiences based on triage assessment.',
    priority: 'normal',
    assigneeId: 'comms-agent',
    dependsOn: [triageTask.id],
  });

  const tasks = orchestrator.getTasks();
  console.log(`   Tasks created: ${tasks.length}`);
  for (const t of tasks) {
    const deps = t.dependsOn.length > 0 ? ` (depends on: ${t.dependsOn.join(', ')})` : '';
    console.log(`   - [${t.priority}] ${t.title} → ${t.assigneeId}${deps}`);
  }
  console.log();

  // 4. Execute the orchestration
  console.log('4. Orchestration Execution');
  const result: OrchestratorResult = await orchestrator.run();

  console.log();
  console.log('5. Orchestration Results');
  console.log(`   Success: ${result.success}`);
  console.log(`   Duration: ${result.durationMs}ms`);
  console.log(`   Completed: ${result.taskGraph.completed.length}/${result.taskGraph.tasks.length}`);
  console.log(`   Failed: ${result.taskGraph.failed.length}`);
  console.log(`   Shared memory entries: ${result.sharedMemory.size}`);
  console.log(`   Progress events: ${progressLog.length}`);
  console.log();

  // Show per-agent results
  console.log('6. Agent Results');
  for (const [key, runResult] of result.agentResults) {
    console.log(`   ${key}:`);
    console.log(`     State: ${runResult.state}`);
    console.log(`     Output: ${runResult.output?.slice(0, 80)}...`);
    console.log(`     Tokens: ${runResult.totalUsage.totalTokens}`);
  }
  console.log();

  // 7. Run eval regression
  console.log('7. Eval Regression Suite');
  const suiteResult = await runEvalSuite('incident-response-regression', 'Incident Response Regression', [
    policyPassthroughScenario(),
    handoffAllowedScenario(),
    handoffBlockedScenario(),
    circuitBreakerStaysClosedScenario(),
    injectionDetectionScenario(),
  ]);

  console.log(`   Suite: ${suiteResult.suiteName}`);
  console.log(`   Status: ${suiteResult.status}`);
  console.log(`   Passed: ${suiteResult.passed}/${suiteResult.total}`);
  for (const r of suiteResult.results) {
    const icon = r.status === 'passed' ? '✓' : '✗';
    console.log(`   ${icon} ${r.scenarioName} (${r.durationMs}ms)`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════');
  console.log(' Example complete. Incident response workflow operational.');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
