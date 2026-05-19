/**
 * Example 05 ── Semantic memory
 *
 * Pre-seed the runtime's memory store with a few semantic facts, then ask a
 * question that requires those facts. The `ContextCompiler` will look up the
 * top semantic entries on every turn and splice them into the system prompt,
 * so the model "remembers" them without us repeating them in the user input.
 *
 * Run: `bun run gemini:05`
 */

import { createAgent } from '@veridex/agents';

import { geminiModelName, geminiProviders, printBanner } from './_shared/gemini.js';

async function main(): Promise<void> {
  printBanner('05 ── Semantic memory');

  const agent = createAgent(
    {
      id: 'memory-agent',
      name: 'Memory Agent',
      model: { provider: 'gemini', model: geminiModelName() },
      instructions:
        'You are an internal assistant for a fictional company. ' +
        'Use the semantic-memory facts you have been given to answer questions accurately. ' +
        'If a fact is not in memory, say you don\'t know.',
    },
    { modelProviders: geminiProviders() },
  );

  // Seed a handful of facts. Each call goes through `MemoryManager.write`,
  // which is also what tools use when they propose memory writes inside a run.
  const facts = [
    'The CEO of Hyperloom is Maya Okafor. She joined in 2024.',
    'Hyperloom\'s flagship product is "Loom-1", a procurement copilot.',
    'Hyperloom is headquartered in Lisbon, Portugal.',
  ];

  for (const content of facts) {
    await agent.memory.write({
      entry: {
        tier: 'semantic',          // semantic = stable, long-lived facts
        kind: 'note',
        content,
        provenance: 'user',         // we (the operator) provided it
        confidence: 0.95,
        scope: 'agent',             // visible to every run on this agent
        ttlMs: 0,                   // 0 = never expire
        tags: ['hyperloom', 'seed'],
      },
      overwriteStrategy: 'skip',
    });
  }

  console.log(`Seeded ${facts.length} semantic facts.\n`);

  const questions = [
    'Who runs Hyperloom and where are they based?',
    'What does Loom-1 do?',
    'What is Hyperloom\'s revenue?', // expected: "I don't know"
  ];

  for (const q of questions) {
    const res = await agent.run(q);
    console.log(`Q: ${q}`);
    console.log(`A: ${res.output}\n`);
  }

  // Inspect what's in memory after the run.
  const allSemantic = await agent.memory.search({ tier: 'semantic', limit: 10 });
  console.log(`Semantic entries in store: ${allSemantic.length}`);

  // Try this next: 06-policy-and-approval.ts to gate a risky tool.
}

main().catch((err) => {
  console.error('\n[05-memory] failed:', err.message ?? err);
  process.exit(1);
});
