# Architecture

## Tech stack

| Layer            | Technology                                                   |
| ---------------- | ------------------------------------------------------------ |
| Runtime          | Cloudflare Workers (web), Node.js (indexer)                  |
| Framework        | Hono (routing + JSX SSR) — **not** React                     |
| JSX              | `hono/jsx` for SSR, `hono/jsx/dom` for client islands        |
| Styling          | UnoCSS (utility-first, generated into `src/uno.css`)          |
| ORM              | Drizzle ORM (SQLite / Cloudflare D1)                         |
| Database         | Cloudflare D1 (SQLite), KV for caching                       |
| Auth             | AT Protocol OAuth via `atproto-oauth-client-cloudflare-workers` |
| API client       | `@atcute/client` for AT Protocol RPC                         |
| Bundler          | Vite (web), tsup (indexer)                                   |
| E2E              | Playwright (`apps/web/e2e/`)                                 |
| Linter/formatter | Biome 2.3.13                                                 |

## Islands architecture

The web app is SSR with selective client hydration:

1. The server renders full HTML with Hono JSX.
2. Interactive components get a placeholder: `<div id="xxx-root" data-props='...'>`.
3. `client.tsx` hydrates each island with `render()` from `hono/jsx/dom`.
4. Current islands: `UploadForm`, `EditForm`, `InfiniteScroll`, `DetailActions`.

## AT Protocol integration

- Collection NSIDs: `com.jjalcloud.feed.gif`, `com.jjalcloud.feed.like`
- Records use `TID.nextStr()` as the rkey
- Upload flow: blob → `com.atproto.repo.uploadBlob`, then `putRecord` with the BlobRef
- The Jetstream indexer subscribes with server-side `wantedCollections` filtered to
  `com.jjalcloud.feed.*`
- Lexicon types are generated — **never hand-edit `apps/web/src/lexicon/`**; run
  `pnpm --filter web lexgen` instead
