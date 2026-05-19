/**
 * Example 04 ── Streaming tokens
 *
 * The runtime exposes `streamRun(input)` which yields every `TraceEvent`
 * in real time, including `token_streamed` events sourced from Gemini's
 * server-sent stream. We print tokens as they arrive ── ChatGPT-style.
 *
 * Run: `bun run gemini:04`
 */

import { createAgent } from '@veridex/agents';

import { geminiModelName, geminiProviders, printBanner } from './_shared/gemini.js';

async function main(): Promise<void> {
  printBanner('04 ── Streaming tokens');

  const agent = createAgent(
    {
      id: 'streaming-agent',
      name: 'Streaming Agent',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions:
        'You are a thoughtful assistant. Answer in 3–5 sentences with concrete examples.',
    },
    {
      modelProviders: geminiProviders(),
      // `enableTracing` defaults to true, but spelling it out here makes the
      // dependency explicit: without tracing there are no `token_streamed`
      // events to subscribe to.
      enableTracing: true,
    },
  );

  process.stdout.write('Reply: ');

  let tokenCount = 0;
  let finalOutput = '';

  for await (const event of agent.streamRun(
    'Explain in plain English what makes an agent runtime different from a chatbot loop.',
  )) {
    if (event.type === 'token_streamed') {
      // `event.data.token` is a small chunk of text (often a few characters).
      process.stdout.write(event.data.token);
      tokenCount += 1;
    } else if (event.type === 'run_completed') {
      finalOutput = (event as { data: { output?: string } }).data.output ?? '';
    } else if (event.type === 'run_failed') {
      const msg = (event as { data: { error?: string } }).data.error ?? 'unknown error';
      throw new Error(msg);
    }
  }

  console.log('\n');
  console.log(`Streamed chunks: ${tokenCount}`);
  console.log(`Final length:    ${finalOutput.length} chars`);

  // Try this next: 05-memory.ts to give the agent recall across questions.
}

main().catch((err) => {
  console.error('\n[04-streaming] failed:', err.message ?? err);
  process.exit(1);
});
