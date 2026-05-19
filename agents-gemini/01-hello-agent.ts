/**
 * Example 01 ── Hello, agent
 *
 * The smallest possible agent built on `@veridex/agents`:
 *   - One model provider (Gemini)
 *   - Zero tools
 *   - One `run(...)` call
 *
 * Run: `bun run gemini:01`  (from the examples/ folder)
 */

import { createAgent } from '@veridex/agents';

import { geminiProviders, printBanner } from './_shared/gemini.js';

async function main(): Promise<void> {
  printBanner('01 ── Hello, agent');

  // 1. Build the agent. The runtime is reusable; you can call .run() many
  //    times on the same instance with different inputs.
  const agent = createAgent(
    {
      id: 'hello-agent',
      name: 'Hello Agent',
      // The `provider` key here must match the key we register below.
      model: { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview' },
      instructions:
        'You are a friendly assistant. Answer in one short sentence.',
    },
    {
      // Map of provider name -> provider instance. `_shared/gemini.ts`
      // returns `{ gemini: <GeminiProvider> }` so the key matches above.
      modelProviders: geminiProviders(),
    },
  );

  // 2. Run it. The first argument is the user's message.
  const result = await agent.run('Say hello to a developer trying Veridex Agents for the first time.');

  // 3. Inspect the result. `output` is the final assistant message.
  console.log('Reply:', result.output);
  console.log('Usage:', result.usage);
  console.log('Turns:', result.run.turns.length);
  console.log('State:', result.run.state);

  // Try this next: open 02-tool-calling.ts to give the agent a real tool.
}

main().catch((err) => {
  console.error('\n[01-hello-agent] failed:', err.message ?? err);
  process.exit(1);
});
