---
status: accepted
---

# The XRPC surface is queries only

`/xrpc/*` serves four public queries — `getFeed`, `getSearch`, `getGif`, `getActorGifs` — and nothing
else. Writes stay on this application's own `/api/*` routes, as does anything that depends on who is
looking. The router is `@atproto/lex-server`'s `LexRouter`, mounted on Hono with one line.

## Why writes are not part of it

In AT Protocol a write goes to the author's own PDS. An AppView answers questions; it does not accept
records. What looks like a write endpoint here — `POST /api/gif` — is really a proxy that writes to
the user's repository using the OAuth session we hold on their behalf. That is a legitimate
backend-for-frontend, and it is not a protocol surface. Neither reference publishes record-writing
procedures under its own NSID.

Drawing the line there also settles what `/api/*` is for, which was previously unclear enough that
the same query logic existed twice: **queries are XRPC, session-bound actions and viewer state are
`/api/*`**. Each surface gets one job.

## Why only four queries, and only ones we serve

tangled declares roughly forty AppView query lexicons and serves none of them. We already have a
smaller version of that disease: `com.jjalcloud.feed.getSearch` is fully specified, has generated
server bindings, and has no handler — while the shipped search is an ad-hoc route that disagrees with
it on path, parameter defaults and response shape. **Declaring what we do not serve is how that
happens.** Since nothing consumes these lexicons yet, all four are defined together now, once, with
one cursor convention and one set of limits.

## Nothing viewer-specific crosses XRPC

Viewer state — whether *you* liked this — needs authentication, and authenticating an AppView means
service auth and `atproto-proxy`, which is a different project. The spec itself says there is no
consistent way yet to even enumerate which endpoints require auth. So `viewer` is optional in the
lexicon, populated on `/api/*`, and absent from `/xrpc/*` responses.

Counts are different: they belong in the view. `likeCount` sits on `gifView` the way Bluesky puts it
on `postView`, which also removes a per-card request the current UI has to make.

## The router is a beta dependency, deliberately

`LexRouter` parses parameters from the lexicon, applies declared defaults, and returns the right
errors — verified against this repo's real lexicons on Hono/Bun: defaults applied, `400
InvalidRequest` on an out-of-range limit, 405 for a POST to a query, 501 for an unknown NSID. That
property is the point: **parameters cannot drift from the lexicon if the lexicon is what parses
them**, and drift is the bug we currently have.

The costs are real. It is 0.1.x with no production consumer inside the atproto monorepo — bsky, pds
and ozone are all still on Express, and the generated `lex gen-server` output is Express-bound and
therefore unusable here. It also **does not validate handler output** (`// @TODO add validation of
output`); a schema-violating body returns 200. We close that in tests, asserting responses against
the lexicon with `bun test`, rather than in the request path.

The exit is cheap and that is what makes the risk acceptable: both references hand-write their XRPC
routes, so falling back means replacing a router behind the same lexicons.

## Consequences

- `gifView.author` is **our own type**, not `app.bsky.actor.defs#profileViewBasic`. That reference is
  currently dangling — it throws on the first `validate()` — and vendoring it would pull in 21 files
  plus a lockfile. Since profiles now live in our Index (ADR-0009), describing our own fields with
  someone else's schema buys nothing. Neither reference references an `app.bsky.*` def at all.
- `handle` is optional on the author view, because a handle is a cache and may be absent (ADR-0009).
  Clients fall back to the DID.
- The cursor is an opaque string (ADR-0006). The existing `cursor: string` shape survives; its
  meaning changes.
- The response field stays `gifs`, not Bluesky's `feed`/`posts`. It is our domain term.
- `GET /api/gif/user/:did` loses its auth requirement by becoming `getActorGifs` — requiring a login
  to view someone's public GIFs was a bug, not a policy.
- **Service discovery is out of scope.** There is no `.well-known` convention that advertises an
  AppView; discovery runs through a DID document's `service` array and the `atproto-proxy` header.
  Publishing a service identity is a new identity to own, it is hard to reverse, and no client is
  asking for it. `/xrpc/*` existing is enough.
