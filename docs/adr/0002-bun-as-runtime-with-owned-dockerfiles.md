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
- One open risk gates this decision: Bun's `node:crypto` has no `secp256k1`, which AT Protocol uses
  for `did:key` k256. Whether any dependency here reaches that code path is being verified before
  the switch.
