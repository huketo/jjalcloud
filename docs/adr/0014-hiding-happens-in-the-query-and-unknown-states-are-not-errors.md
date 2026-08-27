---
status: accepted
---

# Hiding happens in the query, and unknown account states are not errors

The protocol obliges this service to do exactly one thing: never redistribute content for an account
whose hosting status is inactive. That is implemented as a **SQL predicate applied before pagination
and before counting**, driven by two indexed columns on `users`. Content is **hidden, never deleted**.
An account status we do not recognise is stored and treated as hidden — it is not an error.

Read in `~/marimba/atproto` `6a7eff7a7`, `~/marimba/ozone` `001e04a`, `~/marimba/tangled` `29c4aaa`.

## Hide, not delete — this one is forced

`deactivated` is reversible: reactivation on a PDS is an `UPDATE` clearing a timestamp. And `tap` does
**not** replay a repository's records when an account comes back. So a deletion is unrecoverable —
the user returns and their GIFs are gone from our Index with nothing to rebuild them from. Hiding is
the only mechanically safe implementation, not a preference.

## The predicate, and why we do not copy bsky here

bsky applies hiding in **hydration / view assembly**, not in SQL — its SQL soft-delete helper has
exactly one call site in the whole package. The consequences are visible in its behaviour: filtering
runs **after** pagination, so pages shrink while the cursor advances by the full unfiltered limit; and
counts are unqualified `count(*)` that a takedown never re-runs, so aggregates include hidden
content.

We deviate, for three reasons that are ours and not bsky's:

1. **`likeCount` lives inside the view** (ADR-0010). bsky keeps counts in a separate aggregate and
   hides at assembly, so a mismatch is less visible. We put the number in the response, so the number
   and the list must pass the same predicate.
2. **The cursor is a strict keyset over `seq`** (ADR-0006). Post-pagination filtering produces "cursor
   advanced 12, returned 9" — the exact class of bug the cursor decision removed structurally.
3. **The predicate is only expressible because blocks and mutes are out of scope.** bsky filters at
   assembly because it must combine takedowns, labels, blocks, mutes and viewer state in one place;
   our predicate is account status plus the author's self-labels, and nothing else.

Consequence for storage: bsky's `actor.takedownRef` and `actor.upstreamStatus` are **unindexed**,
which is fine when filtering happens after the query. Ours are in the `WHERE` clause, so they are
indexed.

## An unrecognised status must not throw

bsky's `updateActorStatus` **throws** on `desynchronized` and `throttled` — both of which are
declared in `com.atproto.sync.subscribeRepos`'s own `knownValues` (six values in total). Copying that
would be worse than a bug here: ADR-0005 makes a throwing handler mean "do not acknowledge, redeliver",
and `tap` preserves per-repository ordering — so one unrecognised status would **block that
repository's stream forever** and eventually fill the outbox.

An unknown status is neither the transient failure nor the permanent failure of ADR-0005's
classification. It is **valid input**: store it, carry on, and treat it as hidden. Assuming an unknown
state means "active" would be the unsafe direction.

## Self-labels now, with the protocol's vocabulary

`com.atproto.label.defs#labelValue.knownValues` already defines what we need — `porn`, `nudity`,
`graphic-media`, `!no-unauthenticated` — so we invent no vocabulary. Embedding
`com.atproto.label.defs#selfLabels` as an **optional** field in an already-published record lexicon is
compatible (verified against our own lexicon with `@atproto/lexicon` 0.7.11) and has non-app.bsky
precedent in the same repository: `lexicons/site/standard/document.json:59-61` and
`publication.json:26-28`.

It goes in now rather than later because the lexicon is already being edited (ADR-0008 loosens the
Like key), and because every GIF published before the field exists stays permanently unlabelled.

## `!no-unauthenticated` is hidden on XRPC, and the rest is downstream

Our XRPC surface has no viewer by design (ADR-0010), so it treats every request as unauthenticated and
hides content whose author carries the label. This is stricter than the author asked for — they wanted
it hidden from *logged-out* viewers — and it is the safe direction: the label's own definition is
`defaultSetting: 'hide'` with a `no-override` flag.

A viewer-aware read path would relax it, but whether one exists at all depends on the origin and
session decisions for the split frontend, so that question belongs there rather than here. Worth
knowing: bsky enforces this server-side in only three thread-view sites and leaves the rest to
clients.

## Operator intervention is SQL

**Ozone cannot be reused.** It hard-requires `appviewUrl` and `appviewDid` to boot and every
human-facing view is bound to `app.bsky`, so it is not a moderation console for a third-party NSID
AppView. Building our own console would create an authentication, authorisation and audit surface,
which is past this effort's destination.

So: a documented SQL procedure. This is less bare than it sounds, because **record-level takedowns are
invisible to us anyway** — a PDS taking a record down writes a local `takedownRef` and emits nothing on
the firehose. The reconciliation script from ADR-0005's ticket is therefore the actual takedown
mechanism for anything the author removed; manual intervention covers only what is still on the PDS and
that we choose not to show.

For calibration: tangled ships **no** moderation surface at all, and its `#account` handler is two
TODOs.
