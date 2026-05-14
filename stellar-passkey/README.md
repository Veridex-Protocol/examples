# Veridex × Stellar Passkey Demo

End-to-end demo wiring [`@veridex/sdk`](../../packages/sdk) into
[`@creit.tech/stellar-wallets-kit`](https://github.com/Creit-Tech/Stellar-Wallets-Kit)
as a first-class wallet module.

## What it shows

1. Registering a Veridex passkey in the browser (WebAuthn / secp256r1).
2. Plugging `VeridexStellarWalletModule` into `StellarWalletsKit`
   alongside Freighter, xBull, Lobstr, WalletConnect, etc.
3. Calling the kit's standard surface — `getAddress`, `signMessage`,
   `signTransaction`, `signAuthEntry` — and watching the passkey-backed
   path run end-to-end.

## Run locally

```bash
cd examples/stellar-passkey
bun install   # or npm install
bun run dev   # http://localhost:5181
```

WebAuthn requires HTTPS or `localhost`. The demo defaults to testnet —
configure mainnet by changing `StellarNetworks.TESTNET` → `PUBLIC` in
`src/App.tsx`.

## Related

- ADR-0047: Stellar passkey + Soroban integration
  (`docs/architecture/decisions/0047-stellar-passkey-soroban-integration.md`)
- On-chain half: `packages/contracts/stellar/passkey-smart-account/`
- SDK adapter: `packages/sdk/src/chains/stellar/`
