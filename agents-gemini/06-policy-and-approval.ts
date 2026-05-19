/**
 * Example 06 ── Policy + human approval
 *
 * Risky tools should never run silently. We give the agent a `schedule_email`
 * tool (safety class = "write"), then add a policy rule that escalates that
 * tool to a human. Our approval handler prints the request to the terminal
 * and waits for `y/n` on stdin.
 *
 * Run: `bun run gemini:06`  (then type `y` or `n` when prompted)
 */

import { createAgent, tool } from '@veridex/agents';
import type { ApprovalRequest, PolicyRule, ToolContract } from '@veridex/agents';
import readline from 'node:readline';
import { z } from 'zod';

import { geminiModelName, geminiProviders, printBanner } from './_shared/gemini.js';

function askYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

async function main(): Promise<void> {
  printBanner('06 ── Policy + approval');

  const scheduleEmail = tool({
    name: 'schedule_email',
    description: 'Schedule an email to be sent to the given recipient at the given time.',
    input: z.object({
      to: z.string().email(),
      subject: z.string().min(1),
      bodyPreview: z.string().min(1),
      sendAtIsoUtc: z.string(),
    }),
    safetyClass: 'write',
    async execute({ input }) {
      // In a real app you'd hand this off to a queue. We just acknowledge it.
      return {
        success: true,
        llmOutput: `Email queued to ${input.to} at ${input.sendAtIsoUtc}.`,
      };
    },
  });

  // Custom policy rule: escalate any call to `schedule_email`.
  // (You can also use the built-in `requireApprovalFor(['write'], toolsMap)`
  //  if you have a handle to the tools map.)
  const requireApprovalForEmail: PolicyRule = {
    id: 'demo:require-approval-for-email',
    name: 'Require approval for email scheduling',
    description: 'Force human approval before scheduling any email.',
    evaluate(ctx) {
      if (ctx.proposal.type !== 'tool_call') {
        return {
          ruleId: this.id, ruleName: this.name, passed: true,
          verdict: 'pass', reason: 'not a tool call', riskContribution: 0,
        };
      }
      const wantsEmail = ctx.proposal.toolCalls.some((tc) => tc.name === 'schedule_email');
      if (wantsEmail) {
        return {
          ruleId: this.id, ruleName: this.name, passed: false,
          verdict: 'escalate',
          reason: 'Scheduling an email requires explicit human approval.',
          riskContribution: 0.7,
        };
      }
      return {
        ruleId: this.id, ruleName: this.name, passed: true,
        verdict: 'pass', reason: 'no email scheduling', riskContribution: 0,
      };
    },
  };

  const agent = createAgent(
    {
      id: 'approval-agent',
      name: 'Approval Agent',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions:
        'You are an executive assistant. When asked to schedule an email, ' +
        'call `schedule_email` with sensible defaults. Always confirm what you did.',
      tools: [scheduleEmail as ToolContract],
    },
    {
      modelProviders: geminiProviders(),
      policyRules: [requireApprovalForEmail],
      approvalHandlers: {
        // The runtime calls this any time a policy `escalate` verdict matches
        // an approval route that resolves to mode `human_required`. By default
        // the "default route" maps escalations here. Returning a decision
        // unblocks the run; returning `approved: false` aborts it.
        human_required: async (raw) => {
          const request = raw as ApprovalRequest;
          const proposal = request.proposal as { toolCalls?: Array<{ name: string; arguments: unknown }> };
          const tc = proposal.toolCalls?.[0];
          console.log('\n── APPROVAL REQUEST ──');
          console.log(`Reason: ${request.reason}`);
          console.log(`Tool:   ${tc?.name}`);
          console.log(`Args:   ${JSON.stringify(tc?.arguments, null, 2)}`);
          const ok = await askYesNo('Approve? [y/N] ');
          return {
            requestId: request.id,
            approved: ok,
            decidedBy: 'cli-operator',
            reason: ok ? 'operator approved' : 'operator denied',
            decidedAt: Date.now(),
          };
        },
      },
    },
  );

  const result = await agent.run(
    'Schedule an email to demo@example.com tomorrow at 9am UTC. ' +
    'Subject: "Welcome to the pilot", body: "Excited to have you on board."',
  );

  console.log('\nReply:\n', result.output);
  console.log('\nFinal state:', result.run.state);
  console.log('Policy decisions:', result.run.policyDecisions.length);
  console.log('Approval decisions:', result.run.approvalDecisions.length);

  // Try this next: 07-checkpoint-and-resume.ts to handle approvals out-of-band.
}

main().catch((err) => {
  console.error('\n[06-policy-and-approval] failed:', err.message ?? err);
  process.exit(1);
});
