---
status: accepted
---

# One transaction per Ingest event, and no batching

The Ingest writes each Ingest event in its own transaction and only then lets the event be
acknowledged. The batching layer that used to sit in front of the writes is deleted, not ported.

This looks like a performance regression and is deliberately not one, which is the whole reason
this ADR exists.

## Why the batching existed, and why it stops making sense

The batcher coalesced writes because the Ingest reached D1 over its HTTP API, where **every
statement costs one HTTP round trip**. Against a Postgres connection with pooling (ADR-0004) that
cost is gone, so the batcher's only justification goes with it.

## Why batching is now actively harmful

`tap` acknowledges an event **after the handler's promise resolves**, and deliberately does not
acknowledge when the handler throws — that is the entire durability story, and it is the reason for
adopting tap (ADR-0003). A handler that enqueues and returns resolves immediately, so tap
acknowledges the event *before* it is written. Any crash then loses events that the sender believes
were delivered. Batching does not merely add latency here; it silently converts at-least-once
delivery into at-most-once.

The batcher also reordered operations by type within a flush — all upserts, then all deletes — so a
delete followed by a re-create inside one flush applied the delete last and lost the record.

## Consequences

- Acknowledgement is the runner's job and lives in exactly one place. `apply` receives an injected
  transaction and never acknowledges anything, so "acknowledge only after commit" cannot be
  violated from inside the domain code.
- If write throughput ever becomes the constraint, the answer is back-pressure at the sender —
  tap's outbox — not re-coalescing writes underneath the acknowledgement. Reintroducing a batcher
  reintroduces the bug above.
- The measured 15k events/s figure for tap is its *drain* rate on a backfill, not our steady-state
  write load. Do not use it to justify batching.
- Deploys can now be interrupted mid-transaction without loss, because an unacknowledged event is
  redelivered. A short draining window (10s) exists only so that a torn transaction does not appear
  in the logs on every deploy — not to flush a queue, because there is no queue.
