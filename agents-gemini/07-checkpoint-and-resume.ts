/**
 * Example 07 ── Checkpoints & resume
 *
 * This time we register NO approval handler. When the policy escalates, the
 * runtime suspends the run, writes a checkpoint to the store, and emits an
 * `approval_requested` event. We then ── as if from a separate process ──
 * inspect the pending request and resume the run with an out-of-band decision.
 *
 * Run: `bun run gemini:07`
 */

import {
  createAgent,
  InMemoryCheckpointStore,
  tool,
} from '@veridex/agents';
import type { PolicyRule, ToolContract } from '@veridex/agents';
import { z } from 'zod';

import { geminiModelName, geminiProviders, printBanner } from './_shared/gemini.js';

async function main(): Promise<void> {
  printBanner('07 ── Checkpoint & resume');

  const transferFunds = tool({
    name: 'transfer_funds',
    description: 'Move money between two internal ledger accounts.',
    input: z.object({
      fromAccount: z.string(),
      toAccount: z.string(),
      amountUSD: z.number().positive(),
      memo: z.string().optional(),
    }),
    safetyClass: 'financial',
    async execute({ input }) {
      return {
        success: true,
        llmOutput: `Moved $${input.amountUSD} from ${input.fromAccount} to ${input.toAccount}.`,
      };
    },
  });

  const requireApprovalForTransfers: PolicyRule = {
    id: 'demo:require-approval-for-transfers',
    name: 'Require approval for transfers',
    description: 'All ledger transfers must be human-approved.',
    evaluate(ctx) {
      if (ctx.proposal.type !== 'tool_call') {
        return { ruleId: this.id, ruleName: this.name, passed: true, verdict: 'pass', reason: '', riskContribution: 0 };
      }
      const needs = ctx.proposal.toolCalls.some((tc) => tc.name === 'transfer_funds');
      return needs
        ? { ruleId: this.id, ruleName: this.name, passed: false, verdict: 'escalate', reason: 'Transfer requires approval', riskContribution: 0.8 }
        : { ruleId: this.id, ruleName: this.name, passed: true, verdict: 'pass', reason: '', riskContribution: 0 };
    },
  };

  const checkpointStore = new InMemoryCheckpointStore();

  const agent = createAgent(
    {
      id: 'treasury-agent',
      name: 'Treasury Agent',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions:
        'You are a treasury bot. When asked to move money, call `transfer_funds` once with the right arguments.',
      tools: [transferFunds as ToolContract],
    },
    {
      modelProviders: geminiProviders(),
      policyRules: [requireApprovalForTransfers],
      enableCheckpoints: true,
      checkpointStore,
      // NOTE: no `approvalHandlers` registered → run suspends instead of resolving inline.
    },
  );

  // ── Step 1: Start the run. It will suspend at the approval gate. ──
  const firstResult = await agent.run(
    'Transfer $250 from "ops-ckg" to "marketing-jpy" with memo "Q4 campaign top-up".',
  );

  console.log('First call state:', firstResult.run.state);
  if (firstResult.run.state !== 'waiting_for_approval') {
    console.log('Reply (no approval was needed):\n', firstResult.output);
    return;
  }

  // ── Step 2: Pretend we're a different process. List checkpoints + pending requests. ──
  const checkpoints = await agent.listCheckpoints(firstResult.run.id);
  const latest = checkpoints[checkpoints.length - 1];
  if (!latest) throw new Error('Expected at least one checkpoint to exist.');

  const pending = agent.approvals.getPending();
  const request = pending[pending.length - 1];
  if (!request) throw new Error('Expected at least one pending approval.');

  console.log(`Pending approval: ${request.id}`);
  console.log(`Checkpoint:       ${latest.id}`);

  // ── Step 3: Approve out of band and resume from the checkpoint. ──
  const resumed = await agent.resumeFromCheckpoint(latest.id, {
    approval: {
      approved: true,
      approver: 'cfo@example.com',
      requestId: request.id,
      reason: 'Pre-authorised quarterly transfer.',
    },
  });

  console.log('\nResumed state:', resumed.run.state);
  console.log('Reply:\n', resumed.output);
  console.log('Approval decisions:', resumed.run.approvalDecisions.length);

  // Try this next: 08-multi-agent-handoff.ts to coordinate two agents.
}

main().catch((err) => {
  console.error('\n[07-checkpoint-and-resume] failed:', err.message ?? err);
  process.exit(1);
});
