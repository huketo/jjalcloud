---
status: accepted
---

# Serial Ingest, and a commit-ordered feed sequence

The feed is ordered by a monotonic sequence the Index assigns on first insert, not by the record's
own `createdAt`. That sequence is only correct because the Ingest applies one Ingest event at a
time, serially. **The two decisions are one decision**, and separating them breaks the feed.

## Why not the record's own timestamp

`createdAt` is written by the author, on the author's PDS, and this service has no say in it. A
record dated in the future pins itself to the top of the feed permanently; a backdated one is never
seen. Ordering a shared feed by a value strangers control is not a bug to patch but a wrong choice
of key.

`indexedAt` remains as a column because "when did we first see this" is a real operational
question. It is deliberately **not** the sort key: one column, one job.

## Why the sequence needs a serial writer

Keyset pagination assumes that once a reader has passed position N, nothing will later appear
before N. A sequence number is drawn *before* a transaction commits, so with concurrent writers a
row holding 100 can commit after a reader already went past 101 — and that row is then invisible to
every existing cursor, permanently.

**Timestamps do not fix this.** `indexedAt` has exactly the same hazard, which is why the choice of
key and the choice of concurrency are the same decision. Serialising the Ingest is what makes
sequence order equal commit order.

The cost is a throughput ceiling on ingest, and it is the same trade ADR-0005 already made: this
service's steady-state write load is the rate at which people publish GIFs. If a backfill surge is
ever too slow, the lever is back-pressure at tap's outbox, not concurrency in the writer.

## Consequences

- **Do not parallelise the Ingest runner** — not per repo, not across repos — without first
  replacing the ordering key with something derived from commit order. A future reader will see a
  single-threaded consumer and want to fix it; this is the note saying it is load-bearing.
- Ties are structurally impossible, so the class of bug where a tiebreaker appears in `ORDER BY`
  but is forgotten in `WHERE` cannot recur. That bug exists in the current code, twice.
- The cursor is **opaque** to clients. This service is an AppView, so other people's clients hold
  cursors, and an opaque cursor is what keeps the internal representation changeable.
- The sequence is assigned on first insert and **preserved** across updates and redeliveries.
  Otherwise tap resyncing one repository would march that author's whole catalogue to the top of
  everyone's feed, without the author doing anything.
- Ordering by arrival means that after the cutover's full re-backfill the feed would be clustered
  by repository rather than by time. The sequence is therefore reassigned once, in `createdAt`
  order, after the backfill completes and before any client holds a cursor.
- `createdAt` is still displayed, clamped to `indexedAt` as an upper bound, so a future-dated record
  cannot claim a date this service would be asserting on the author's behalf.
