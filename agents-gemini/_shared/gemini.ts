/**
 * Shared Gemini bootstrap used by every example in this folder.
 *
 * - Loads `.env` from the examples/agents-gemini directory (if present).
 * - Builds a configured `GeminiProvider` using `GOOGLE_API_KEY`.
 * - Exposes the resolved model name so each script can print it.
 *
 * Keeping this in one tiny file lets each numbered example stay focused on a
 * single agents concept instead of repeating provider boilerplate.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { GeminiProvider } from '@veridex/agents';

/** Load `.env` from the agents-gemini folder. Safe to call multiple times. */
export function loadEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  loadDotenv({ path: resolve(here, '..', '.env') });
}

/** The model name we will use for `model.model` in `createAgent(...)`. */
export function geminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

/**
 * Build a `GeminiProvider` from env. Throws a friendly error if no key is set
 * so beginners get a clear next step instead of a 401 from the API.
 */
export function makeGeminiProvider(): GeminiProvider {
  loadEnv();

  const apiKey =
    process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      [
        'GOOGLE_API_KEY is not set.',
        '',
        '  1. Get a key at https://aistudio.google.com/app/apikey',
        '  2. Copy examples/agents-gemini/.env.example to .env',
        '  3. Paste your key into GOOGLE_API_KEY=...',
      ].join('\n'),
    );
  }

  return new GeminiProvider({ apiKey, model: geminiModelName() });
}

/**
 * Convenience: returns the shape `createAgent` expects for `modelProviders`.
 * The key MUST match `definition.model.provider` ── we use `'gemini'`.
 */
export function geminiProviders(): Record<string, GeminiProvider> {
  return { gemini: makeGeminiProvider() };
}

/** Pretty banner used at the top of each example. */
export function printBanner(title: string): void {
  const bar = '='.repeat(60);
  console.log(`\n${bar}\n${title}\n${bar}`);
  console.log(`Model: ${geminiModelName()}\n`);
}
