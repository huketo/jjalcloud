---
status: accepted
---

# Blobs are proxied on a content-addressed path

Every GIF is served through this service's own `/img/:did/:cid` route, which resolves the author's
PDS at request time and streams the blob back with `Cache-Control: public, max-age=31536000,
immutable`. The route is a pure function of `(did, cid)` so any renderer — server or browser — can
build the URL without a lookup, and it refuses pairs that are not in the Index.

## Why not the author's PDS directly

Because it does not work, and because the spec says not to. A blob URL built from a fixed host
breaks permanently the moment its author migrates PDS: the old host deactivates the account and
`getBlob` there answers `400 RepoDeactivated` — not a redirect, not a 404. This was reproduced
against a real migrated account, using this repo's own hardcoded URL. Separately,
`atproto.com/specs/blob` requires applications to proxy blobs through an independent CDN or proxy
before serving them to browsers, and calls direct-from-PDS serving "not a recommended or required
pattern".

Hotlinking is also expensive for the wrong party. `getBlob` answers `Cache-Control: private` with
no `ETag`, no `Last-Modified` and no range support, so a grid of GIFs re-downloads every original
in full on every render, and no cache anywhere may keep them. PDS rate limits are 3000 points per
5 minutes keyed by **client IP**, so a single origin IP is the whole service's budget against any
one PDS.

## Why a pure `(did, cid)` path

One call site builds blob URLs in the browser. A signed URL — tangled's camo shape — can only be
minted server-side, so adopting it would force derived URLs into API responses and into the query
lexicons. bsky uses an unsigned `(did, cid)` path, and the remains of a deleted signed-URL scheme
are still visible in its cache invalidator, which is a decent hint about how that experiment went.

Being unsigned makes the route an open proxy, which bsky simply accepts. We close it instead by
serving only `(did, cid)` pairs already present in the Index — a row we are reading anyway.

## Consequences

- `immutable` is honest here only because the URL names a content hash. That also makes upstream
  bytes checkable against the CID, and makes a mimetype allowlist load-bearing: without one, a
  transient JSON error body from a PDS would be cached for a year.
- The caching layer is the CDN already fronting `jjalcloud.com`, not code we write. Both reference
  implementations put caching outside the app — bsky disables its own resizer in production in
  favour of a CDN, and tangled runs its proxy as an edge worker. Note that bsky's passthrough route
  sets **no** cache-control at all and lets the upstream `private` through; that is an unfinished
  path with a TODO in it, not a pattern to copy.
- A proxy is an SSRF hole by default. The hardening set is not optional: https-only with a
  unicast-IP check, header and body timeouts, a maximum response size, a redirect limit, an image
  mimetype allowlist, aborting the upstream fetch when the client disconnects, and streaming rather
  than buffering whole blobs.
- **`400 RepoDeactivated` invalidates this DID's cached PDS and the request is retried** — a
  deliberate deviation from bsky, which collapses every upstream 4xx into an uncacheable 404 and
  never refreshes identity from an error. The evidence for deviating: over the full history of a
  sampled DID set, a PDS endpoint never moved without the signing key moving too (7/7), so this
  error is a reliable staleness signal rather than a missing blob. Absorbing it as a 404 instead
  would leave every image from that author broken until the identity cache expires — up to 24h.
- Deciding to proxy does not decide what the grid should be served. Neither reference resizes images
  in the application; that question is its own ticket.
