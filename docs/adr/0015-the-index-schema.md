---
status: accepted
---

# The Index schema

The convergence point: eight closed decisions fed columns into this one. Written against
`~/marimba/atproto` `6a7eff7a` (the bsky AppView's Postgres schema) and `~/marimba/tangled`
`29c4aaa3`.

The governing fact is in `CONTEXT.md`: the **Index is derived and reconstructible from PDSes**. Every
choice below is allowed to be cheap about durability and expensive about correctness of what is
served.

## Duplicates are quarantined, not tolerated

Likes carry a `(subject, author)` unique constraint, and duplicate records go into a
`duplicate_record` side table.

This reverses an earlier position. Legacy Likes written before subject-derived rkeys (ADR-0008) still
sit in users' repositories with TID rkeys and **cannot be cleaned up** — we can only write to a
repository while its owner is logged in — so `(author, subject)` can already have several records. The
tempting conclusion was "no unique constraint, count distinct authors instead".

bsky does better: `like_unique_subject (subject, creator)` is a real unique index, and duplicates are
recorded in `duplicate_record` via `findDuplicate`, with one promoted if the canonical row is deleted
(`indexing/plugins/like.ts:19-42,45-56`, `indexing/processor.ts:70-110,116-172`). We need it simpler
still: unliking deletes **every** rkey the Index holds for that pair, so there is nothing to promote —
canonical and duplicates go together.

What that buys: uniqueness becomes an enforced invariant, counting is `count(*)` rather than
`count(distinct …)`, and duplicates live somewhere they cannot affect a read.

tangled shows the other road's ending. It dropped its uniqueness constraints and added a
`deduped_stars` view — then **forgot to apply it to reactions**, so `count(did) from reactions` counts
duplicates, with no index (`appview/db/reaction.go:62-66`). A view is a convention; a constraint is
not.

## Counts are computed on read — for one reason, and not the obvious one

`likeCount` is computed per query, not maintained.

The reasoning is **not** "an incremental counter would double-count on redelivery", because that is not
how the reference does it either: **bsky never deltas.** Every aggregate update is a full `COUNT(*)`
recompute of the affected row, dispatched to a post-commit background queue, which makes it naturally
idempotent under at-least-once delivery (`indexing/processor.ts:271-278`).

The actual reason is the **visibility predicate** (ADR-0014). A maintained aggregate is not recomputed
when some liker's account status changes, so it cannot reflect the predicate — it would drift exactly
the way bsky's does. Computing on read is what keeps the number and the list telling the same story.
With duplicates quarantined this is cheap: `count(*)` plus a join to `users`.

**The one place in bsky where a visibility predicate, keyset pagination and a count coexist is
`routes/notifs.ts:30-58,94-131` — and the three use different predicates.** That is the failure this
schema has to design against: the predicate is built in one place and the list query, the count query
and the cursor all consume it.

## Ordering and the indexes that serve it

`seq` is unique, so there is **no tiebreaker at all** — a strict `seq < cursor` and `ORDER BY seq DESC`.
bsky needs `(sortAt, cid)` row-comparison because `sortAt` is not unique (`db/pagination.ts:93-118`);
ADR-0006's choice pays off here as a simpler query and a narrower index.

Indexes exist to serve cursors and are composite for that purpose alone — bsky created
`like_creator_cursor_idx (creator, sortAt, cid)` and friends specifically to serve keysets, replacing
single-column indexes (`20230929T192920807Z-record-cursor-indexes.ts`). Ours are `(seq)` for the global
feed and `(author, seq)` for an author's feed, and the visibility predicate's columns are indexed
because — unlike bsky's — they are in the `WHERE`.

Incidental find worth keeping: bsky's `sortAt` is a **generated column** `least(createdAt, indexedAt)`.
That is the same expression recommended for *display* clamping in ADR-0006. Since ordering moved to
`seq`, we keep the expression as a generated column purely so display does not recompute it per row.

## Column choices

- **Raw records are `text`, not `jsonb`.** They are kept for recovery, not for querying — and `jsonb`
  reorders keys and discards whitespace, which destroys the ability to re-derive a CID. In a
  content-addressed system that property is worth more than queryability we do not need. bsky's
  `record.json` is `text` too.
- **Timestamps are `timestamptz`.** AT Protocol datetimes carry offsets and we store author values
  verbatim; the current SQLite column is second-precision integer, and precision now only affects
  display since it is not the sort key.
- **Blobs are `blob_cid` / `blob_mime` / `blob_size`** with the raw record alongside (ADR-0007/0009).

## Tombstones, and what their retention actually means

Deletes write to a separate `tombstones(uri, rev, deleted_at)` table rather than soft-deleting in
place, which would keep dead rows occupying `seq` and add a condition to the visibility predicate.

Retention is **7 days**, and the number means one specific thing: **after a tombstone expires, a late
create resurrects the record with a new `seq`, putting it at the top of the feed.** The real exposure
is `TAP_RETRY_TIMEOUT` (60s) plus the backfill fan-out window, so 7 days is generous. Swept lazily
behind a partial index.

bsky has no tombstones — deletes are plain row deletions. This is ours.

## Identity caches: two tables, because of the reverse lookup

`did_docs(did, doc, fetched_at)` and `handles(handle, did, verified_at)`, stale at 1h and hard-expired
at 24h.

Two tables rather than one keyed store specifically so `handles` can be searched **by did**. ADR-0009
requires reading the previously-stored handle before overwriting it, because an identity event carries
only the new one — the three-key invalidation problem that tangled left unsolved. An index turns it
into a lookup.

## OAuth state and session storage

Modelled on the PDS's own OAuth tables (`account-manager/db/migrations/004-oauth.ts`): partial unique
indexes and an `expiresAt` sweep index. Expiry is **lazy opportunistic GC with a grace period** —
`removeOldExpiredQB` uses 600s — not a scheduled job. That also sidesteps Railway's 5-minute minimum
cron interval.

## Migrations

A **release step**, not a boot step, owned by one service. bsky wires a Migrator but
`migrateToLatestOrThrow` is never called from production source; it isolates schemas with a
per-connection `search_path`.

We add a `pg_advisory_lock` around it, which bsky does not have and does not need — we will have four
services and cannot have two of them migrating at once. It is the same mechanism ADR-0007's ticket
already chose for the OAuth `requestLock`.

The six existing SQLite migrations are **discarded for a single baseline**. Cutover re-backfills
everything, so there is no history to preserve, and there were no indexes in them to port — index
design is new work either way.

The baseline also runs **`CREATE SCHEMA tap`**. tap honours `?search_path=tap` but never creates the
schema (ADR-0011), and if it is missing tap silently creates its seven tables in ours. Putting it in
the baseline makes "the database is migrated" mean "tap can boot", so a new environment cannot forget.

## What is ours rather than the reference's

Worth naming, because each is a place where copying would have been easier: the dead-letter table,
tombstones, the advisory lock, and a visibility predicate in SQL. bsky's ingest runs a `MemoryRunner`
from cursor 0 whose `onError` only logs — **no dead-letter table, no persisted cursor** — and its
takedown filtering is not a predicate on the paginated queries at all.
