---
status: accepted
---

# Railway as the deployment target

jjalcloud ran on Cloudflare Workers with D1 and four KV namespaces, while the Ingest ran as a
separate unmanaged Node process — two halves with no shared deployment story and no CI/CD at all.
We are moving both to Railway so that every part of the service is one deployable unit set with
one pipeline.

## Considered options

Staying on Workers was viable for the website alone — the audit found **no Workers-only runtime
API anywhere in `apps/web/src`**, so the coupling is narrow. It fails for the service as a whole:
the Ingest is a long-lived websocket consumer with a durable cursor, which is not a shape Workers
serves, and `tap`'s TypeScript client cannot authenticate its websocket upgrade from an edge
runtime at all (its browser transport reports `HEADERS_SUPPORTED = false`), leaving webhooks as
the only edge-compatible delivery mode.

## Consequences

- The four KV namespaces backing the OAuth stack (DID cache, handle cache, OAuth state, and the
  session store holding refresh tokens and DPoP private keys) have no Railway equivalent and must
  be reimplemented. See ADR-0004.
- Nothing in the request path relies on Cloudflare's edge cache today, so nothing regresses by
  leaving it — but nothing was hiding a caching problem either, and a single-region origin makes
  the absent caching visible.
- `jjalcloud.com` stays. The OAuth `client_id` is derived from the deployment URL, so keeping the
  domain keeps the client identity stable and spares every user a re-consent.
- Volumes on Railway cannot be shared between services and forbid replicas, which is what forces
  the store decision in ADR-0004.
