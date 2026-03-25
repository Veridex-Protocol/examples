# FinOps Guardian

FinOps Guardian is a practical Veridex agent demo that audits SaaS spend, finds wasted subscriptions, and takes governed actions with visible policy and approval checkpoints.

This is the kind of demo that can spread because the value is obvious in one sentence:

"We let an AI agent audit our SaaS stack. It found five figures in annual savings, took the safe actions automatically, and asked for approval before anything risky."

## Why This Demo Works

- It is measurable. The output is dollar savings, not vague productivity claims.
- It is relatable. Every startup and ops team understands bloated SaaS spend.
- It showcases Veridex strengths. Tools, policy, approvals, memory, hooks, events, and checkpoints are all visible.
- It answers the common criticism that agents are just theater. This one produces a concrete before-and-after financial result.

## What The Agent Does

- Lists subscriptions and usage posture
- Can call a real external HTTP API to verify live signals from an allowlisted service
- Identifies the highest-ROI savings opportunities
- Checks vendor guardrails before acting
- Drafts vendor communications
- Downgrades or pauses low-risk subscriptions
- Attempts a cancellation only when policy and approval allow it
- Produces a CFO-style summary with savings and blocked actions

## Run It

From the repo root:

```bash
export OPENAI_API_KEY=your_key_here
export FINOPS_SIGNAL_API_BASE_URL=https://jsonplaceholder.typicode.com
npx tsx examples/finops-guardian/src/index.ts
```

From this directory:

```bash
export OPENAI_API_KEY=your_key_here
export FINOPS_SIGNAL_API_BASE_URL=https://jsonplaceholder.typicode.com
npx tsx src/index.ts
```

## External API Tool

The example now includes a network tool named `fetch_external_api_signal`.

It makes a real outbound `GET` request with these guardrails:

- It only calls the configured base service from `FINOPS_SIGNAL_API_BASE_URL`
- Hostnames must be allowlisted in `FINOPS_ALLOWED_API_HOSTS`
- It supports an optional bearer token via `FINOPS_SIGNAL_API_KEY`
- It returns a truncated response preview plus structured data back to the agent

Example configuration:

```bash
export FINOPS_SIGNAL_API_BASE_URL=https://api.github.com
export FINOPS_ALLOWED_API_HOSTS=api.github.com
export FINOPS_SIGNAL_API_KEY=your_token_if_needed
```

Example invocation pattern inside the agent:

```text
Use fetch_external_api_signal with path /repos/veridex/protocol to verify live metadata before recommending action.
```

## Demo Prompt

The built-in prompt asks the agent to:

```text
Audit our SaaS stack and take the maximum safe savings actions you can.
1. Find the biggest waste by annualized savings.
2. Take reversible actions immediately when justified.
3. Attempt one cancellation only if policy allows it.
4. Explicitly call out anything blocked by guardrails.
5. End with a board-ready summary of money saved and why the agent is safe.
```

## What To Show In A Video

- The agent identifies real savings opportunities
- The policy engine escalates write and destructive actions
- The approval handler allows reversible moves and blocks protected vendors
- The final report ties actions back to annualized savings

That is the proof point: the agent is useful because it can act, and it is trustworthy because Veridex governs how it acts.