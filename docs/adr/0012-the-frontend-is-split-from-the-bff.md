---
status: accepted
---

# The frontend is split from the BFF

The web service becomes two: a **BFF** owning the XRPC queries, the session-bound write routes, the
blob proxy and OAuth; and a **Frontend** owning rendering. Four services plus Postgres.

This was an open question rather than a requirement — none of the four transitions this effort exists
to settle (Railway, Bun, tap, ATProto conformance) needs it — and it was decided in favour of
splitting with the costs below accepted knowingly.

## What made it cheap

ADR-0010 already drew the data boundary a split needs: **reads are `/xrpc/*`, writes and viewer state
are `/api/*`**. Nothing about that changes. The split moves rendering, not data access, and the
Frontend becomes the first consumer of an XRPC surface we were going to publish anyway — which is a
useful forcing function: if our own client is awkward to write against it, so is everyone else's.

## What it does not fix

It was tempting to justify the split by the duplication it removes. That justification does not hold,
and the prototype on `prototype/bff-split` shows why: the grid card exists twice — once as
`components/gif/GifCard.tsx` for SSR, once rebuilt imperatively in `islands/InfiniteScroll.tsx:33` —
but a component authored with the repo's default `hono/jsx` runtime renders correctly **both** via
`toString()` and via `hono/jsx/dom`'s `render()`. Measured, not argued. The duplication was an
unnecessary reimplementation, fixable in place.

So the split is being adopted for architecture, not to solve that. Recording this matters: otherwise
someone later reads the split as the fix for a problem it never fixed.

## Costs accepted

- **Server-rendered share cards are at risk.** `/gif/:rkey` currently emits OpenGraph tags from SSR
  (`renderer.tsx:29-36`, populated at `routes/page.tsx:336-340`). On a GIF-sharing service the share
  card is a feature, so something must still render it server-side for crawlers. Who and how is an
  open decision.
- **The session becomes a cross-origin question.** Today the cookie is `httpOnly`, `SameSite=Lax`,
  same origin. Whether the Frontend shares the origin (path-routed behind the CDN already fronting
  the domain) or gets its own decides whether CORS, cookie domain and `SameSite` become live
  problems — or stay dissolved. Open decision.
- **A fourth deploy unit**, with its own Dockerfile, its own place in the pipeline and its own step
  in the cutover.
- The 16 shared components under `components/` gain nothing from the move; they are already plain
  JSX.

## Consequences

- The blob proxy `/img/:did/:cid` (ADR-0007) stays on the **BFF**: it resolves the author's PDS per
  request and checks Index membership, both of which are backend concerns.
- Vite and UnoCSS (kept per the charting decision) move with rendering: the Frontend owns its own
  build, and `vite-ssr-components`' asset tags leave `renderer.tsx` along with SSR — if SSR leaves at
  all, which the share-card decision settles.
- The Frontend needs viewer state (`isLiked`), which ADR-0010 put on `/api/*`. That coupling is why
  the origin decision comes before the others.
- Three decisions are now open and blocked in that order: the origin and session boundary, then
  share-card ownership and the Frontend's own stack.
