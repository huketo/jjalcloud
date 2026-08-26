---
status: accepted
---

# Bun as the runtime, with Dockerfiles we own

We are replacing Node and pnpm with Bun as both toolchain and **runtime**, keeping Hono as the web
framework. Railway's builder (Railpack) does not detect Bun as a runtime — its own Bun guide tells
you to add a Dockerfile — so each service gets a Dockerfile in this repo rather than relying on
build detection.

## Considered options

Bun as package manager only, with Node still running the server, was the lower-friction path:
Railpack would build it with no Dockerfile. We rejected it because it forfeits everything the
switch is for — `Bun.serve`, `Bun.SQL`, `bun:sqlite`, `bun test` — leaving only a faster install.

## Consequences

- Owning the Dockerfiles is a feature: builds no longer depend on a hosted heuristic, and the same
  image is reproducible locally. It is also maintenance we now carry.
- `bun install --frozen-lockfile` is **not** implied in CI; the flag has to be explicit.
- pnpm-specific machinery has to go or be translated: the `catalog:` protocol, `pnpm -r` /
  `--filter` scripts, the `packageManager` pin, and `workerd` in `onlyBuiltDependencies`. Bun has
  its own catalogs and `--filter`, so the translation is mechanical.
- Bun does not run dependency lifecycle scripts unless the package is listed in
  `trustedDependencies`, which is how native-addon installs break quietly.
- Vite and UnoCSS stay, run as `bunx --bun vite`. Bun's own bundler documents CSS via LightningCSS
  and a Tailwind plugin but says nothing about UnoCSS, and replacing the CSS engine is not on the
  route this repo is taking.
- Playwright documents Node as its runtime and does not mention Bun, so the e2e suite is expected
  to keep running under Node even after the switch.
- Bun's `node:crypto` has no `secp256k1`, which AT Protocol uses for `did:key` k256. This was
  raised as a gate on the decision and has been **verified not to block it** (issue #8): every
  k256 path in this dependency surface runs on pure-JS `@noble/*` under Bun — `@atproto/crypto`
  unconditionally, and `@atcute/crypto` because its `#keypairs/secp256k1` import condition lists
  `bun` ahead of `node`. Nothing in `apps/` or `packages/` reaches a signature-verification path at
  all. The one place an ES256K key would have been requested is DPoP key generation, and `jose`
  already resolves the same browser build for `workerd` as for `bun`, so today's Workers deployment
  is likewise falling back to ES256 — Bun reproduces production rather than changing it.
