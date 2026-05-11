/**
 * Shared helper: read PRIVATE_KEY from env and fail fast if missing.
 *
 * Rationale (security hygiene sweep, 2026-04-24):
 * Example files previously fell back to the publicly-known Hardhat test
 * account #0 private key:
 *   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 *
 * That fallback is safe only on a local Hardhat node. If a user copies an
 * example, forgets to set PRIVATE_KEY, and points it at any public network
 * (even a testnet), funds can be swept by automated bots that scan that
 * address. This helper removes the fallback entirely.
 *
 * For local Hardhat development, set:
 *   export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 * explicitly so the choice is intentional.
 */
export function requirePrivateKey(envName = 'PRIVATE_KEY'): string {
  const value = process.env[envName];
  if (!value) {
    console.error(
      `\n\u2716 ${envName} is not set.\n\n` +
        `  Set it before running this example:\n\n` +
        `    export ${envName}=<0x-prefixed hex private key>\n\n` +
        `  For local Hardhat development, the well-known account #0 key works:\n` +
        `    export ${envName}=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\n\n` +
        `  NEVER paste a real mainnet key into shell history. Use a .env file\n` +
        `  that is gitignored, or a secrets manager.\n`,
    );
    process.exit(1);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    console.error(`\u2716 ${envName} must be a 0x-prefixed 32-byte hex string.`);
    process.exit(1);
  }
  return value;
}
