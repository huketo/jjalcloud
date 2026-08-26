---
status: accepted
---

# Profiles are indexed, not fetched

Profile data arrives through the same pipe as the content: the Ingest tracks
`app.bsky.actor.profile` alongside this project's own collections, and the AppView reads its own
Index. The dependency on `public.api.bsky.app` is removed entirely. A stored handle is treated as a
**cache with a verification timestamp**, never as authority.

## Why not keep calling the other AppView

Because it makes a decentralised service depend on one company's read API for the identity of every
author it displays, and because it does not work well: a feed page fires one outbound request per
distinct author, with no batching, no cache and no memoisation. It also imported values that have
nothing to do with this service — follower and post counts from a different application were being
rendered on our profile pages.

Neither reference does this. bsky indexes `app.bsky.actor.profile` off the firehose and contains no
code path that fetches profile data over HTTP from another service. tangled owns its own profile
lexicon and reads no Bluesky AppView data at all. The single external AppView call in either
codebase is a last-resort avatar fallback in tangled's image worker — the exact call we had made our
primary path.

Indexing is also nearly free here: the growth model adopts a repository when it writes one of our
NSIDs, so **the people whose profiles we need to display are precisely the repositories the Ingest
already tracks**. The cost is that tap's collection filter is process-global, so the filter set is a
deployment concern.

## The handle is a cache

An identity event's handle is a **trigger, not data**. bsky ignores the value and uses the event only
to force a re-resolution, which it verifies bidirectionally; tangled verifies its declared handle
against the DID document's `alsoKnownAs` on both write and ingest. We do the same, and store
`handle_verified_at` so the cache admits what it is.

Handles are recycled, and a stale mapping does not fail — it silently points at a different person
who legitimately claims that handle. So invalidation needs three keys: `did→doc`, `oldHandle→did`,
`newHandle→did`. The event carries only the new handle, so the old one must be read before it is
overwritten. **There is no reference to copy here**: tangled's identity handler purges only the
DID-keyed entry, leaving its handle-keyed entry to live out a 24h TTL — the same bug, unsolved.

Display falls back from handle to **DID**, never to an invented string.

## Contention nulls the loser

`handle` is nullable and unique; when a new actor claims a handle, the previous holder's handle is set
to null. This is bsky's rule, and bsky has a migration whose only purpose is dropping `NOT NULL` to
enable it.

tangled does the opposite — it rejects the new claimant — and that is right for tangled and wrong
for us, because the two handles are different things. tangled's is a **user-declared vanity value**
it owns, so refusing a duplicate is legitimate. Ours is a **fact about the network**: the handle
really did move, and refusing it would mean declining to record reality. (tangled also enforces its
rule in application code with no unique index behind it, which cannot win a race.)

## Consequences

- Avatars are blob refs in our Index, served through the content-addressed proxy of ADR-0007 — not
  foreign CDN URLs stored as strings, which is what the `users.avatar` column held. bsky refuses to
  boot when no image endpoint is configured; that is the right severity for a missing proxy config.
- Profile records are stored the way ADR-0008 stores blobs: normalised columns plus the raw record.
  bsky does the same, and notably its **raw record JSON is authoritative for views** while the
  normalised table is a shadow.
- Profile counts come from our own Index — GIFs published, likes received — or they are not shown.
- Killing the N+1 becomes a join rather than a batch, because we have one database where bsky has a
  separate dataplane. But **any profile lookup we expose over XRPC must be batch-shaped**: tangled's
  `getProfiles` accepts up to 50 subjects and bsky's takes a DID list. A single-subject endpoint
  hands our N+1 to every client that calls us.
- Other people's profile pages stop being a stub. That page was empty because it had no data source,
  not because of a UI gap.
- A stale handle in a URL answers 404. Convention diverges — frontpage 404s, tangled 302s, bsky.app
  serves its shell — but with handles being recycled a redirect can send someone to a stranger.
