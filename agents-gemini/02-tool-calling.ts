/**
 * Example 02 ── Tool calling
 *
 * Adds one typed tool (`get_time`) and lets Gemini decide to call it.
 * Tools in `@veridex/agents` are explicit contracts:
 *   - Name + description (what the model sees)
 *   - A Zod input schema (validated before execution)
 *   - A `safetyClass` (read | write | financial | admin | ...)
 *   - An `execute` function that returns a result for the model
 *
 * Run: `bun run gemini:02`
 */

import { createAgent, tool } from '@veridex/agents';
import type { ToolContract } from '@veridex/agents';
import { z } from 'zod';

import { geminiModelName, geminiProviders, printBanner } from './_shared/gemini.js';

async function main(): Promise<void> {
  printBanner('02 ── Tool calling');

  // A read-only tool that returns the current time in a given IANA timezone.
  const getTime = tool({
    name: 'get_time',
    description:
      'Return the current date and time as an ISO string for an IANA timezone (e.g. "America/Los_Angeles", "UTC").',
    input: z.object({
      timezone: z
        .string()
        .describe('IANA timezone, e.g. "UTC" or "Europe/Berlin".'),
    }),
    safetyClass: 'read',
    async execute({ input }) {
      const now = new Date();
      // `Intl.DateTimeFormat` accepts any IANA zone the OS supports.
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: input.timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(now);

      return {
        success: true,
        llmOutput: `The current time in ${input.timezone} is ${formatted}.`,
      };
    },
  });

  const agent = createAgent(
    {
      id: 'time-agent',
      name: 'Time Agent',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions:
        'You help users find the current time. Always use the get_time tool ── never guess.',
      tools: [getTime as ToolContract],
      maxTurns: 4,
    },
    { modelProviders: geminiProviders() },
  );

  const result = await agent.run('What time is it right now in Tokyo and in New York?');

  console.log('Reply:\n', result.output, '\n');

  // Tool activity is captured as trace events. Filter the ones we care about.
  const toolEvents = result.events.filter((e) => e.type === 'tool_executed');
  console.log(`Tool calls executed: ${toolEvents.length}`);
  for (const e of toolEvents) {
    const data = (e as { data: { toolName: string; success: boolean; durationMs: number } }).data;
    console.log(`  · ${data.toolName}  ok=${data.success}  ${data.durationMs}ms`);
  }

  // Try this next: 03-multi-tool-research.ts ── two tools and a planning loop.
}

main().catch((err) => {
  console.error('\n[02-tool-calling] failed:', err.message ?? err);
  process.exit(1);
});
