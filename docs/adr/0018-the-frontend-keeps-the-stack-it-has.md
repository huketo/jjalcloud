---
status: accepted
---

# The Frontend keeps the stack it has, builds on Node, and runs on Bun

The Frontend is a server-rendering Hono JSX service — the stack that exists today, minus the routes the
BFF takes. It is built by Vite running on Node inside the image, and served by Bun. That makes four
services.

Investigated: `bluesky-social/social-app` `c4c999ff`, Hono v4.13.5, HonoX v0.1.61,
`vite-ssr-components` v0.6.1, UnoCSS v66.8.1, Vite v8.2.2, Playwright 1.63.

## A static SPA does not remove the service

`bskyweb` is exactly the shape the SPA option imagines: its own usage string reads *"web server for
bsky.app web app (SPA)"* (`cmd/bskyweb/main.go:26-27`), `base.html:156`'s `<div id="root">` is empty, and
the repository contains zero occurrences of `react-dom/server`. It injects Open Graph and Twitter Card
tags per route from Go handlers into pongo2 templates (`server.go:606-733`, `templates/post.html:13-45`).

Reading it settles the question against the SPA:

1. **`bskyweb` is itself a service.** A static host cannot produce per-route meta tags, so a server
   exists anyway. The SPA option does not yield three services and a static site; it yields four
   services, one of which is dumber.
2. **It makes blocking upstream calls on the HTML request path** — `getPostThread(depth=1,
   parentHeight=80)` for a post, `getProfile` **plus** `getAuthorFeed` for a profile. Its own comment
   concedes the cost: *"NOTE: extra XRPC call on every public profile render; consider caching
   per-profile if upstream load becomes a concern."* The upstream traffic is the same either way.
3. **It ships crawler-visible content inside `<noscript>`** — author, DID, post text, timestamp
   (`post.html:99-113`) — directly beneath a heading that says *"JavaScript Required"*. So the argument
   "the grid already needs JavaScript, therefore server-rendered content buys nothing" is refuted by the
   precedent: it requires JavaScript and still emits a summary for machines.

There is also a standing tax. The SPA's route table lives in Go, hand-maintained, with no catch-all
(`server.go:308-347`), so a client route nobody adds to the server **404s on hard navigation** and works
only via client-side transitions. Keeping SSR keeps routes in one place.

Migrating to another framework was the third option and is rejected for absence of a reason: it rewrites
16 components and 5 islands, and the prototype already measured that the existing components render both
ways.

### One correction to the prototype's finding

`hono/jsx/dom` has no `hydrate`, but **`hono/jsx/dom/client` does export `hydrateRoot`** — and it is a
no-op alias, as its own source says: *"In hono/jsx/dom, hydrate is equivalent to render."*
(`src/jsx/dom/client.ts:67-83`). The behaviour is as the prototype found — `render` ends in
`container.replaceChildren(fragment)`, discarding server markup wholesale (`render.ts:785-801`) — but the
symbol exists. Recorded because anyone re-checking this will find `hydrateRoot`, assume the prototype was
wrong, and reach the opposite conclusion.

HonoX is not adopted for the same reason: its default `hydrate` *is* `render`, and it works around the
absence of hydration by serialising props to `data-serialized-props` and stashing SSR'd children in
`<template data-hono-template>` elements. It buys a convention, not hydration, and imposes a constraint —
*"You cannot access a Context object in Island components."* Our five islands already do the same thing
with less machinery.

## Caching is the CDN's job because nothing else can do it

Public routes render viewerless and are CDN-cacheable; authenticated routes are viewer-specific and
`private, no-store`.

| routes | viewer-dependent | caching |
|---|---|---|
| `/`, `/gif/:rkey`, `/profile/:identifier` | no | CDN |
| `/profile`, `/upload`, `/edit/:rkey` | inherently | `private, no-store` |

ADR-0017 made viewerless SSR the rule; two facts make it load-bearing rather than a nicety. **`hono/cache`
does not support Bun** — it covers Cloudflare Workers and Deno only — and **`serveStatic` sets no default
`Cache-Control`**. A Bun + Hono service therefore has *zero* caching at every layer by default, and the
CDN in front of `jjalcloud.com` is the only cache there is. `bskyweb` reaches the same place from the
other direction, setting `Cache-Control` from the application and admitting in a comment that upstream
load wants caching.

The visible cost is a header that briefly shows a logged-out state until a small island fills it in from
`/api/*`. `page.get("/")` currently reads the cookie to compute `isLoggedIn` (`routes/page.tsx:161-163`);
that has to move client-side, or the page is not cacheable.

## No client router

Routing exists once, on the server. A client router earns its place in an SPA; here it would add history,
scroll restoration and focus management for nothing. Infinite scroll already appends without navigating.

## Static assets, served by the service

`hono/bun`'s `serveStatic`, with three things set explicitly:

- **`Cache-Control` in `onFound`** — `public, immutable, max-age=31536000`, per Hono's own example, since
  there is no default.
- **`precompressed: true`** — serves pre-existing `.br` / `.zst` / `.gz` sidecars in Brotli → Zstd → Gzip
  order and never compresses on the fly, so the build must emit the sidecars.
- **An asset base URL from the environment**, empty by default. This is `bskyweb`'s `--static-cdn-host`
  (default `""`): empty means same-origin, set means a CDN, with no code change.

## UnoCSS stays, via the Vite plugin

UnoCSS's documentation is **silent** on Bun — every mention is a `bun add` install tab, there is no
integration page and no `@unocss/bun` package. It does not matter: `@unocss/vite`'s only peer dependency
is `vite`, so whichever runtime executes Vite executes UnoCSS.

The apparent escape hatch is not one. `@unocss/cli`'s binary starts `#!/usr/bin/env node`
(`packages-engine/cli/bin/unocss.mjs:1`), so under Bun it silently runs on Node — the same shebang trap as
Vite. `@unocss/postcss` carries an explicit warning that it does not follow semver.

Since the BFF renders no HTML — `/login` is a Frontend page, the OAuth callback only redirects, errors are
JSON — **the CSS pipeline exists in exactly one service**, and the BFF's image needs no build stage for it.

## Types come from packages/common

The concern that this ties the deployment unit to the monorepo is already true: the BFF and the indexer
both depend on `packages/common`. Excepting the Frontend would give us two copies of the lexicon types,
and ADR-0010 made the generated types the contract that `/xrpc/*` output is tested against.

## Build on Node, run on Bun

Charting recorded `bunx --bun vite` as a premise. The evidence does not support making it one:

- **Bun's own Vite guide opens by steering you off Vite** — *"many projects get faster builds & drop
  hundreds of dependencies by switching to HTML imports."*
- **Vite declares `engines.node` only**, its documentation's Bun tab shows `bunx vite` *without* `--bun`,
  and its single Bun-specific note is a warning that Bun's automatic `.env` loading interferes with Vite's
  env handling.
- **Neither project documents Vite SSR under the Bun runtime.**

Build and runtime separate cleanly. Vite is needed at build and dev time; production is `bun run` over the
build output. So the build stage of the image runs Node and the final stage is Bun-only — every
Vite-under-Bun risk avoided at zero runtime cost. This is the control ADR-0002 bought by owning the
Dockerfiles.

`vite-ssr-components` is kept. Despite the README's framing it is **not** Cloudflare-specific: zero peer
dependencies, zero Cloudflare imports in `src/`, maintained by Hono's own author, and it carries an
explicit `if (!environments.ssr)` path that bakes the manifest in through `define`
(`src/plugin/auto-entry.ts:99-109`). Dropping `@cloudflare/vite-plugin` does not disturb it — one fewer
thing to replace.

## End-to-end tests run two servers, BFF first

Playwright takes an array of `webServer` entries (since 1.24). Two things are worth writing down:

- **They start sequentially, in array order**, each awaited to readiness. This is not documented; it falls
  out of one plugin per entry, one task per plugin, and a sequential `for … await` in the task runner. Two
  entries at the default 60 s timeout can burn 120 s before the first test.
- **Array mode drops the implicit `baseURL`.** We already set it explicitly
  (`playwright.config.ts:18`) — but it must point at the **single origin** through the dev proxy, or the
  suite exercises a topology that does not exist in production (ADR-0017).

Log-based readiness (`wait: { stdout }`) would express the BFF-then-Frontend dependency directly, but it
needs Playwright ≥ 1.57 and the repo pins `^1.56.0`.

## Two traps for whoever renders the share card

Recorded here because they were found here, and handed to that decision:

- **Server-rendering third-party text inherits a moderation problem.** `bskyweb`'s `jsonld.go` is 733
  lines with a 1696-line test file — larger than `server.go` — and contains its own label-based redaction
  tier, because *"reply text would otherwise be emitted into the parent post's structured data."* Our OG
  tags will carry user-authored GIF titles and alt text, so ADR-0014's visibility predicate has to reach
  the share card too. Also, og:image and JSON-LD `image[]` must be byte-identical *"per Google's
  requirement."*
- **Hono's metadata hoisting appends rather than replaces.** A `<title>` in the head plus a component
  `<title>` yields two titles (`docs/guides/jsx.md:119`).
