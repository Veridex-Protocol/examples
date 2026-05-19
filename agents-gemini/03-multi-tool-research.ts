/**
 * Example 03 ── Multi-tool research
 *
 * Two tools force the model to *plan*: first search a fake knowledge base,
 * then summarize the hits. The agent keeps looping (up to `maxTurns`) until
 * it produces a final answer.
 *
 * Run: `bun run gemini:03`
 */

import { createAgent, tool } from '@veridex/agents';
import type { ToolContract } from '@veridex/agents';
import { z } from 'zod';

import { geminiModelName, geminiProviders, printBanner } from './_shared/gemini.js';

// A toy "knowledge base" so the example is fully offline (apart from the LLM).
const KB: Record<string, string> = {
  veridex:
    'Veridex is a decentralized authority and trust layer for AI agents, ' +
    'offering passkey wallets, policy-gated payments, and ERC-8004 identity.',
  agents:
    'The @veridex/agents package is a TypeScript-first agent runtime with ' +
    'typed tools, policy engine, approvals, memory, and trace events.',
  gemini:
    'Gemini is Google DeepMind\'s family of multimodal LLMs. ' +
    'The 2.5 series supports tool calling and SSE streaming.',
};

async function main(): Promise<void> {
  printBanner('03 ── Multi-tool research');

  const searchKb = tool({
    name: 'search_kb',
    description:
      'Search the internal knowledge base. Returns matching snippets keyed by topic.',
    input: z.object({
      query: z.string().describe('Free-text query, e.g. "what is veridex".'),
    }),
    safetyClass: 'read',
    async execute({ input }) {
      const q = input.query.toLowerCase();
      const hits = Object.entries(KB)
        .filter(([key, value]) => q.includes(key) || value.toLowerCase().includes(q))
        .map(([key, value]) => `[${key}] ${value}`);

      return {
        success: true,
        llmOutput: hits.length
          ? hits.join('\n')
          : 'No matches found. Try a different query.',
      };
    },
  });

  const summarizeText = tool({
    name: 'summarize_text',
    description:
      'Compress a block of text into a one-paragraph summary you can show the user.',
    input: z.object({
      text: z.string().min(1),
      maxWords: z.number().int().positive().default(40),
    }),
    safetyClass: 'read',
    async execute({ input }) {
      // Intentionally trivial: trim to N words. The model can wrap this
      // with its own polish before presenting.
      const words = input.text.split(/\s+/).slice(0, input.maxWords);
      return {
        success: true,
        llmOutput: words.join(' ') + (words.length === input.maxWords ? ' …' : ''),
      };
    },
  });

  const agent = createAgent(
    {
      id: 'research-agent',
      name: 'Research Agent',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions: [
        'You are a research assistant. To answer a question:',
        '  1. Call `search_kb` with a relevant query.',
        '  2. If the result is long, call `summarize_text` on it.',
        '  3. Then write the final answer in your own words.',
        'Never fabricate facts ── only use what the tools return.',
      ].join('\n'),
      tools: [searchKb as ToolContract, summarizeText as ToolContract],
      maxTurns: 6,
    },
    { modelProviders: geminiProviders() },
  );

  const result = await agent.run(
    'Give me a one-paragraph overview of Veridex and how the agents package fits in.',
  );

  console.log('Reply:\n', result.output, '\n');
  console.log(`Turns:          ${result.run.turns.length}`);
  console.log(`Tool calls:     ${result.events.filter((e) => e.type === 'tool_executed').length}`);
  console.log(`Total tokens:   ${result.usage.totalTokens}`);
  console.log(`Final state:    ${result.run.state}`);

  // Try this next: 04-streaming.ts to print tokens as they arrive.
}

main().catch((err) => {
  console.error('\n[03-multi-tool-research] failed:', err.message ?? err);
  process.exit(1);
});
