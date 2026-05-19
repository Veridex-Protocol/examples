/**
 * Example 08 ── Multi-agent (tool-driven hand-off)
 *
 * Real "handoffs" in `@veridex/agents` are powerful but require the model to
 * emit a strict JSON envelope, which is fragile to prompt. The simpler,
 * more reliable pattern for beginners is **tool-driven delegation**:
 *
 *   triage agent ──(consult_specialist tool)──▶ specialist agent ──▶ answer
 *
 * The triage agent stays in charge of the conversation; the specialist runs
 * as an isolated `agent.run(...)` whose final output becomes the tool's
 * llmOutput. Same boundaries, same tracing, far less prompt engineering.
 *
 * Run: `bun run gemini:08`
 */

import { createAgent, tool } from '@veridex/agents';
import type { ToolContract } from '@veridex/agents';
import { z } from 'zod';

import { geminiModelName, geminiProviders, printBanner } from './_shared/gemini.js';

async function main(): Promise<void> {
  printBanner('08 ── Multi-agent (tool-driven hand-off)');

  // ── Specialist: only knows SQL questions. ──
  const sqlSpecialist = createAgent(
    {
      id: 'sql-specialist',
      name: 'SQL Specialist',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions: [
        'You are a senior database engineer.',
        'Answer in 2–3 sentences with a concrete example query.',
        'If the question is not about SQL, say so honestly.',
      ].join(' '),
    },
    { modelProviders: geminiProviders() },
  );

  // Tool that lets the triage agent delegate to the specialist.
  const consultSqlSpecialist = tool({
    name: 'consult_sql_specialist',
    description:
      'Forward a question to the SQL specialist agent and return its answer verbatim. ' +
      'Use ONLY for database/SQL/query questions.',
    input: z.object({
      question: z.string().min(1).describe('The user\'s SQL question, restated clearly.'),
    }),
    safetyClass: 'read',
    async execute({ input }) {
      const sub = await sqlSpecialist.run(input.question);
      return {
        success: true,
        llmOutput: sub.output,
        metadata: { delegatedRunId: sub.run.id, delegatedTurns: sub.run.turns.length },
      };
    },
  });

  // ── Triage: a generalist that knows when to delegate. ──
  const triage = createAgent(
    {
      id: 'triage-agent',
      name: 'Triage Agent',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions: [
        'You are a friendly triage assistant.',
        'For general questions, answer directly in 2-3 sentences.',
        'For anything involving SQL, databases, queries, or schemas,',
        'call `consult_sql_specialist` once and then relay its answer to the user.',
      ].join(' '),
      tools: [consultSqlSpecialist as ToolContract],
      maxTurns: 4,
    },
    { modelProviders: geminiProviders() },
  );

  const prompts = [
    'In one sentence: what is a TypeScript discriminated union?',     // triage answers directly
    'How do I write a SQL query to find the second-highest salary?',   // triage delegates
  ];

  for (const p of prompts) {
    const r = await triage.run(p);
    const delegations = r.events.filter(
      (e) => e.type === 'tool_executed' &&
        (e as { data: { toolName: string } }).data.toolName === 'consult_sql_specialist',
    ).length;
    console.log(`Q: ${p}`);
    console.log(`A: ${r.output}`);
    console.log(`   (delegated to specialist: ${delegations > 0 ? 'yes' : 'no'})\n`);
  }

  console.log('You\'ve completed the ladder. See README.md for next steps.');
}

main().catch((err) => {
  console.error('\n[08-multi-agent-handoff] failed:', err.message ?? err);
  process.exit(1);
});
