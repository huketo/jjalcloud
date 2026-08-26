---
status: accepted
---

# tap for Ingest, behind an adapter seam

The Ingest is moving from a hand-rolled Jetstream consumer to
[`tap`](https://github.com/bluesky-social/indigo/tree/main/cmd/tap), Bluesky's sync daemon, with
the [`@atproto/tap`](https://www.npmjs.com/package/@atproto/tap) client. The condition attached to
that adoption is structural: our Ingest code stays a thin handler behind one event interface, and
Jetstream and tap are two adapters of it.

## Considered options

Fixing the existing consumer in place would close some of the gaps — a durable cursor, resolving
each DID's real PDS instead of assuming `bsky.social`, consuming identity and account events, and
validating records against their Lexicon before writing. It cannot close the one that matters most:
Jetstream is transcoded JSON and carries no signatures, so **no amount of work on that path yields
commit-signature or MST verification**. Getting that means consuming the relay firehose directly,
which is what tap already is.

tap also arrives with per-repository ordering, at-least-once delivery with acks (a handler that
throws is simply not acked, so the event is retried), rev-based deduplication, cursor persistence
every second, automatic resync from the authoritative PDS after a failed MST validation, and
adoption of new repositories off the live firehose within seconds. Measured under Bun: ~15k
events/s.

## Consequences

- tap is beta by its own README, and its last functional commit was 2026-03-10 — five months before
  this decision. Its TypeScript client is actively released, which reads as a stable daemon rather
  than an abandoned one, but that is an inference, not a guarantee.
- **The seam is what makes the risk affordable.** Keeping ingest logic behind one event interface
  keeps reverting to Jetstream a one-adapter change instead of a rewrite, which is what demotes a
  beta dependency to a reversible choice. Losing the seam loses the justification for the decision.
- tap is a third stateful component with its own database and GORM `AutoMigrate` on every boot, no
  migration files and no versioning.
- Backfill is always whole-repository: one heavy Bluesky user who posts a single GIF costs their
  entire repository download, measured at ~2.1 GB peak RSS.
- tap applies back-pressure at 100,000 buffered events and holds ~2 GB there if no consumer is
  attached, so its consumer being down is an operational event, not a degradation.
- Multiple consumers **shard** one stream rather than each receiving a copy, so the Ingest cannot be
  scaled by adding replicas.
- tap moves records, never blobs. Every GIF byte remains ours to fetch from its author's PDS.
