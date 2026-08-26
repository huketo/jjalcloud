---
status: accepted
---

# tap runs isolated, with a resync parallelism of one

tap gets its own Postgres **schema** in our database, a **4 GB** memory ceiling, and
`TAP_RESYNC_PARALLELISM=1`. It is reachable only over Railway's private network, its image is pinned
by digest, and its metrics listener stays off.

Facts below are from `cmd/tap` in indigo at `9cf6b7ee3c`, plus measurements from an earlier
investigation that built and ran it.

## The memory ceiling is the whole operational story

A backfill downloads the entire repository CAR into a byte slice, parses every block into an
in-memory map, and loads the whole MST — **and only then applies the collection filter**. Measured
peak for one 153k-record repository: **~2.1 GB RSS**. The filter does not help; it runs after the
parse.

Worse, this **multiplies**. Concurrency is bounded only by `TAP_RESYNC_PARALLELISM`, whose default
is **5**, and there is no memory-aware admission control. So the real ceiling is five times the
largest repository anyone adopts — and our growth model adopts any repository network-wide that
writes one of our NSIDs, which means a heavy Bluesky user who posts a single GIF.

The two failure modes also amplify each other: when the outbox fills, workers block *mid-walk* at
the pre-flush readiness gate, each still holding its fully parsed blockstore. A wedge is therefore
also five parsed CARs pinned in memory.

Setting parallelism to 1 trades backfill speed for a predictable ceiling. Backfill speed matters
exactly once — at cutover — and the value can be raised for that one run. A crash also restarts a
repository's backfill from the beginning, since partially-resynced repos are reset on boot, so a low
parallelism reduces the cost of retrying too.

## Schema isolation, verified

`AutoMigrate` runs on every boot and creates its seven tables **unqualified**, into
`CURRENT_SCHEMA()`. Pointing tap at our database without isolation would mean a migrator with no
versioning and no rollback touching our production schema every time the service restarts.

`?search_path=tap` works: pgx forwards it as a startup runtime parameter and every query in tap is
schema-unqualified. **tap never creates the schema**, so we must. There is no name collision with
`users`, `likes` or `gifs` today, but tap's `repos` is generic enough that leaving it in the shared
schema would eventually cost us that name.

A separate database would also work. A schema wins on the details: one backup, one connection pool,
one set of connection limits — and both options need one manual DDL statement either way.

## Exposure

No public domain. tap is reached at its `*.railway.internal` address only. This is not a preference:

- HTTP Basic auth guards the main server **only when a password is set**, and the username is
  hardcoded `admin`.
- `TAP_METRICS_LISTEN` opens a **second server with no authentication at all**, with
  `net/http/pprof` registered on it — heap and goroutine dumps to anyone who can reach it. It stays
  off.
- The websocket handler's origin check always returns true.

`/health` falls under the same auth middleware once a password is set, so no Railway healthcheck is
configured. A service without one is marked active on start anyway, and healthchecks are only
queried at deploy time, never continuously — so the check would buy nothing here.

## Image pinning and restarts

The image is pinned **by digest**, not `latest`. A daemon that runs `AutoMigrate` on every boot must
not be able to bring a schema change along with an unattended restart, and `latest` offers little
upside when the last functional commit is five months old. Upgrading becomes a deliberate act.

Restart policy is `on-failure`. An OOM or crash is a safe failure: the firehose cursor is persisted
and resumed. **Periodic restarts are also justified** — the per-DID worker map is never evicted, and
auto-adoption means seeing DIDs from across the network, so memory creeps.

Note that the "save the cursor one last time on shutdown" path passes an already-cancelled context
and therefore **always fails**. Even a graceful SIGTERM replays up to the full 1s save interval.
Harmless, because ingest is idempotent (ADR-0005/0006) — but "graceful means no replay" is false.

## Changing the collection filter is a migration, not a config edit

Filters are process-global environment configuration, so a change needs a redeploy — and a redeploy
only affects **future** events. Getting historical records for a newly added collection requires
removing the repository and letting it be re-adopted, and `/repos/remove` hard-deletes rows while
being **non-durable** under signal-collection tracking: the repository comes back on its next commit,
and re-adoption **re-emits every record as a create**.

So adding a collection later is a full re-emission across every tracked repository. It is safe —
ingest is idempotent — but it is not cheap, and it must be written down as a procedure rather than
discovered. At cutover this costs nothing, because a full backfill is happening anyway.

## When we leave

The escape criterion is **an incident, not a date**: data loss, a correctness bug, or tap failing to
follow a protocol change while upstream stays unresponsive. tap has been frozen for five months and
works — measured at ~15k events/s — so a purely time-based rule would discard working software for
no reason. A date is useful only as a reminder to re-evaluate, not as a trigger.

The TypeScript client is actively released while the daemon is frozen, so a widening gap between them
is the signal to watch.

Leaving means replacing **one adapter** (ADR-0003), and it costs exactly: commit-signature and MST
verification, PDS-resolving backfill, identity events, and cursor durability. That list is the price
of the exit, and it is why the exit is a last resort rather than a plan.

## Monitoring

Watch **consumer silence**, not the outbox. A full outbox is a late symptom; a silent indexer is the
cause. But at our traffic, silence is ambiguous — so the signal that disambiguates is tap's firehose
cursor: the firehose is network-wide and always moving, so a cursor that stops advancing is a real
fault while a quiet outbox is not.

Only filter-matching record events consume outbox capacity — but **identity events bypass filters
entirely**, and every first backfill emits one, so an adoption wave does put pressure on it.
