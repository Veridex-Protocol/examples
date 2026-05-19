# @veridex/agents · Gemini Examples

A ladder of tiny, runnable TypeScript scripts that teach `@veridex/agents`
using Google Gemini as the LLM. Each file is self-contained, heavily
commented, and runs with one `tsx` command.

> Goal: read top-to-bottom and end up understanding the full runtime ── tools,
> memory, streaming, policy, approvals, checkpoints, handoffs ── without
> touching any UI, payment, or chain code.

## Prerequisites

1. **Node 18+** (built-in `fetch`) and Bun *or* npm.
2. A **Google AI Studio API key** ── free tier works:
   <https://aistudio.google.com/app/apikey>
3. Install workspace deps from the repo root:

   ```bash
   bun install
   # or: npm install
   ```

4. Configure your key:

   ```bash
   cd examples/agents-gemini
   cp .env.example .env
   # then edit .env and paste your key into GOOGLE_API_KEY=
   ```

You can override the model by setting `GEMINI_MODEL` in `.env`
(defaults to `gemini-2.5-flash`).

## The ladder

Run each script from the `examples/` folder:

```bash
cd examples
bun run gemini:01     # or: npx tsx agents-gemini/01-hello-agent.ts
```

| #  | Script | What you learn |
|----|--------|----------------|
| 01 | [`01-hello-agent.ts`](./01-hello-agent.ts) | Smallest possible agent: `createAgent` + `GeminiProvider`, one `run(...)`, inspect `output` and `usage`. |
| 02 | [`02-tool-calling.ts`](./02-tool-calling.ts) | Define a typed `tool(...)` with a Zod schema and let Gemini call it. |
| 03 | [`03-multi-tool-research.ts`](./03-multi-tool-research.ts) | Two tools + `maxTurns` ── watch the model plan, call, and summarize. |
| 04 | [`04-streaming.ts`](./04-streaming.ts) | Subscribe to `token_streamed` events for an incremental, ChatGPT-style UI. |
| 05 | [`05-memory.ts`](./05-memory.ts) | Pre-seed semantic memory and ask a question that needs recall. |
| 06 | [`06-policy-and-approval.ts`](./06-policy-and-approval.ts) | A `write`-class tool gated by a policy + a console approval handler. |
| 07 | [`07-checkpoint-and-resume.ts`](./07-checkpoint-and-resume.ts) | Persist a suspended run and resume it from a checkpoint. |
| 08 | [`08-multi-agent-handoff.ts`](./08-multi-agent-handoff.ts) | A triage agent that delegates to a specialist via a tool-driven handoff. |

The examples reuse [`_shared/gemini.ts`](./_shared/gemini.ts) for env loading
and provider construction, so each script can stay focused on one concept.

## Troubleshooting

- **`GOOGLE_API_KEY is not set`** ── you skipped the `.env` step above.
- **`Gemini API error (400)`** ── usually a malformed model name. Check
  `GEMINI_MODEL`.
- **`Gemini API error (429)`** ── rate-limited. Wait a few seconds or use a
  paid key.
- **`Cannot find module '@veridex/agents'`** ── run `bun install` (or
  `npm install`) from the repo root so workspace links resolve.

