---
status: accepted
---

# One origin, and a cookie that holds a secret

The website and the BFF share the origin `jjalcloud.com`; the CDN already in the request path routes by
path prefix. The session cookie carries an unguessable session id, not the user's DID.

## Why one origin

Not for the convenience of avoiding CORS. **For ownership of the CSRF defence.**

ADR-0010 put viewer state (`isLiked`, `likeCount` for the viewer) on the session-bound `/api/*` routes.
A separate origin therefore requires credentialed cross-origin requests, which requires
`credentials: "include"`, a CORS allow-list, and `SameSite=None`. That last one forfeits the CSRF
protection `SameSite=Lax` currently provides for free, and we have no CSRF defence to fall back on — so
a separate origin would oblige us to build one. The cost is not a preflight; it is a security mechanism
we would now own.

Path routing costs no extra hop, because `jjalcloud.com` is already proxied through Cloudflare (ADR-0007
depends on that CDN for immutable blob caching). It is one ruleset, and its contents were fixed by
earlier decisions rather than invented here:

| path | service | fixed by |
|---|---|---|
| `/xrpc/*` | BFF | ADR-0010 |
| `/api/*` | BFF | ADR-0010 |
| `/img/*` | BFF | ADR-0016 — needs a native addon, so it cannot be a Worker or a static host |
| `/oauth/*` | BFF | the callback sets the cookie |
| everything else | Frontend | |

Choosing one origin also leaves the Frontend's stack open: server-rendered service or static bundle,
path routing works either way. A separate origin would imply a separately deployed host and settle that
question prematurely.

**Neither reference puts a session across an origin boundary.** tangled's camo and avatar Workers sit on
their own origins behind HMAC signatures, and bsky serves images from `cdn.bsky.app` — but all three are
*unauthenticated asset proxies*. The HMAC exists precisely because there is no session to carry. Our
`/img/*` could be split on the same reasoning; `/api/*` could not.

## The cookie holds a secret, and the DID is not one

The session cookie's value is currently the bare DID (`routes/oauth.tsx:127`). A DID is a public
identifier, so `httpOnly` and `SameSite=Lax` protect nothing here: both defend against *stealing or
replaying* a cookie, and a guessable value needs neither.

The consequence is visible in the middleware split. `requireAuth` calls `client.restore(did)` and 401s
without a server-side session (`middleware/auth.ts:28-59`); `optionalAuth` attempts the same and
tolerates failure (`:76-95`). But **`requirePageAuth` validates nothing** — it checks that the cookie
exists and sets `did` from its value (`:61-70`) — and it gates `/profile`, `/upload` and `/edit/:rkey`.
Planting `jjalcloud_session=did:plc:<someone else>` renders those pages as that user.

The data exposed today is public anyway, and writes are still blocked because `gif.put`/`gif.delete`/
`like.post` all go through `requireAuth`. So this is not a live breach. It *is* a statement that
page-level authorisation is decorative, and the first private thing to appear on a page inherits a full
impersonation.

Because `requireAuth` already does the right thing, this is an omission rather than a design position.
The fix is not to add `restore()` to the third middleware: that treats the symptom, and the next route
that forgets the call reopens the hole. **Putting the secret in the cookie makes it impossible to
forget.** ADR-0015 already places a `sessions` table in Postgres, so the thing to look the id up in
exists.

## Server-side rendering is viewerless

SSR reads only `/xrpc/*` — public, queries-only, no viewer (ADR-0010). Viewer state arrives after
hydration, from `/api/*`, over the same origin, so the cookie rides along with no `credentials` option
and no CORS.

Two things follow, and both are the point rather than a side effect:

- **The Frontend server never handles a user credential.** The alternative — the Frontend forwarding the
  user's cookie to the BFF — creates a delegation boundary where a server acts on a user's behalf, and
  that is a boundary worth not having.
- **Frontend responses are cacheable at the CDN.** A response that depends on the viewer cannot be
  cached, and having moved off Workers onto Railway we want the CDN absorbing read load.

## Local development keeps one origin too

The dev server proxies `/xrpc/*`, `/api/*`, `/img/*` and `/oauth/*` to the BFF rather than running two
origins. The local OAuth client is an RFC 8252 loopback public client whose `client_id` embeds both the
redirect URI and the scope in its query string (`auth/client.ts:31-38`), so keeping a single origin at
`127.0.0.1:5173` keeps that `client_id` unchanged. Two local ports would also mean a CORS configuration
that exists only in development — two environments with different trust models.

## Moving the client_id is free now, and will not be later

`client_id` is `${PUBLIC_URL}/oauth/client-metadata.json` with `redirect_uris` at
`${PUBLIC_URL}/oauth/callback` (`auth/client.ts:151,157`). While charting, domain retention was recorded
as the argument for a cutover without re-consent. **ADR-0013 spent that already**: narrowing the scope
forces every user to re-consent regardless, and it happens at the same cutover, so changing `client_id`
would now add nothing.

We keep `jjalcloud.com` anyway — one origin does not need a subdomain — but the freedom is worth writing
down, along with its expiry: **after cutover the re-consent cost returns**, and a later origin move pays
it again.

Related implementation debt, not a decision: `auth/client.ts:32` and `:160` still name
`transition:generic`, which ADR-0013 removed. Since the loopback `client_id` embeds the scope, that
change alters the local `client_id` too.
