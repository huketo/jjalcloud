# PROTOTYPE — throwaway. Not production code.

Answers one question for [fullstack SSR 유지 vs BFF + Frontend 분리](https://github.com/huketo/jjalcloud/issues/15):

> Is the duplication we pay for islands-with-SSR forced by the architecture — i.e. is splitting the
> frontend the way out of it?

**No.** A component authored with the repo's default JSX runtime renders correctly on **both**
paths. The duplication in `apps/web/src/islands/InfiniteScroll.tsx` is an unnecessary
reimplementation, not a consequence of being fullstack.

## The finding

`apps/web/src/components/gif/GifCard.tsx` is a Hono JSX component used by every SSR page. The
infinite-scroll island cannot import it — or so the current code implies: `InfiniteScroll.tsx:33`
defines `createGifCardElement(gif): HTMLElement`, building the *same card* imperatively with DOM
calls. **The grid card, the single most important component in a GIF site, exists twice.**

Measured against `hono@4.13.5` (repo declares `^4.11.5`):

| component authored with | `String(Component(props))` — server | `render()` from `hono/jsx/dom` — island |
| --- | --- | --- |
| `@jsxImportSource hono/jsx` *(repo default via tsconfig)* | ✅ correct HTML | ✅ correct DOM |
| `@jsxImportSource hono/jsx/dom` | ❌ `[object Object]` | ✅ correct DOM |

So the default runtime is the portable one. One component file, both paths, no build trickery, no
per-file pragma needed for shared components — only the island *entry* needs
`/** @jsxImportSource hono/jsx/dom */`, which `client.tsx` already has.

Constraint found on the way: `hono/jsx/dom` exports `render` but **no `hydrate`**. Server markup
cannot be hydrated in place; an island renders into its own container. That is what the current code
already does, so nothing changes.

## Reproduce

```
mkdir -p /tmp/proto-bff && cd /tmp/proto-bff && bun init -y && bun add hono happy-dom
cp <this dir>/{probe.tsx,card-server.tsx,card-dom.tsx} .
bun run probe.tsx server   # component authored with hono/jsx
bun run probe.tsx dom      # component authored with hono/jsx/dom
```

## Ownership ledger — what a split would actually move

After [XRPC 표면의 범위](https://github.com/huketo/jjalcloud/issues/10), the data boundary a split
needs **already exists**: reads are `/xrpc/*`, writes and viewer state are `/api/*`. So a split moves
rendering only.

| Today | After a split | Cost of moving it |
| --- | --- | --- |
| 8 SSR pages (`home`, `detail`, `profile`, `edit`, `upload`, `login`, `privacy`, `terms`) | client-rendered | OpenGraph cards die for `/gif/:rkey` unless something re-renders them server-side — on a GIF-sharing site the share card is a feature, not chrome |
| 5 islands (`InfiniteScroll`, `UploadForm`, `EditForm`, `DetailActions`, `uploadFormUtils`) | ordinary components | this is the gain — but the experiment above shows it is available without splitting |
| 16 shared components (`ui/`, `layout/`, `gif/`, `profile/`, `form/`) | unchanged | none; they are already plain JSX |
| session cookie, `httpOnly` + `SameSite=Lax`, same origin | cross-origin | CORS, cookie domain, and `SameSite` all become live questions |
| 3 services + Postgres | 4 services | one more deploy unit, one more Dockerfile, one more thing in the cutover |
| `vite-ssr-components` asset tags in `renderer.tsx` | gone | a separate frontend owns its own build |

## Verdict

The split is **not required by any of the four transitions** this map exists to settle (Railway, Bun,
tap, ATProto conformance), and the one concrete pain it promised to fix is fixable without it. What
remains is a preference about architecture, paid for with a fourth service, cross-origin session
handling, and the loss of server-rendered share cards.

Recommended: **out of scope**, with the real finding — deduplicate the grid card by rendering the
shared `GifCard` through `hono/jsx/dom` inside `InfiniteScroll` — recorded as ordinary work rather
than a decision.
