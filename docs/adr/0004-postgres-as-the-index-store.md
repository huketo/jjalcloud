---
status: accepted
---

# Postgres as the Index store

The Index moves from D1 to a Railway-hosted Postgres, shared over private networking by the three
services (website, Ingest, tap). The Drizzle schema is rewritten from `sqlite-core` to `pg-core`
and the existing SQLite migrations are discarded and regenerated.

## Considered options

**SQLite on a Railway volume** was the cheaper shape and would have left the schema untouched. It
is structurally impossible for more than one service, because a Railway volume cannot be shared
between services — so it only works if the website and the Ingest collapse into a single process.
That merge also means every deploy restarts the Ingest, forbids replicas permanently, and
guarantees downtime on redeploy even with a healthcheck. With real users and automatic deploys,
paying downtime on every push is the wrong trade.

**Network SQLite (Turso/libSQL)** would have kept the schema unchanged, but reintroduces exactly
the kind of external platform dependency this move exists to shed.

## Consequences

- The rewrite is small in surface — three tables, three JSON-bearing columns — and the migration
  history is worth losing: the current one is SQLite-flavoured and there are **no indexes in it at
  all**, so index design is new work either way rather than a port.
- The four KV namespaces land here too: OAuth state, the session store holding refresh tokens and
  DPoP private keys, and the DID and handle caches. The session store is the only durable one; the
  caches can be reconstructed.
- Postgres opens a real path for search, which is currently `LIKE %q%` across titles and raw tags
  JSON. That path is not taken by this ADR, only unblocked.
- tap accepts `postgres://` for its own state, so it can share the instance rather than adding a
  volume — decided separately.
- The Index remains derived: it is reconstructible from PDSes, which is what makes discarding the
  existing data at cutover acceptable. `users` is the only table carrying anything a PDS cannot
  return.
