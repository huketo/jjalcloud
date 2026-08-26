---
status: accepted
---

# Writes go through one validated builder, and Likes are keyed by their subject

Every record this service writes into someone's repository is assembled by one function that
validates it against its Lexicon first. Likes get an rkey derived from the subject they point at, so
a repeated Like overwrites itself instead of accumulating. GIF rkeys are minted by the PDS.

Two parts of this deliberately depart from both reference implementations, which is why they are
recorded here.

## Validation is ours, and it is not optional

The PDS cannot validate our records. Its validator knows a hardcoded ~20-entry schema map, so for a
`com.jjalcloud.*` NSID: `validate` unset writes without checking anything and reports
`validationStatus: "unknown"`, and **`validate: true` returns HTTP 400 `"Unknown lexicon type"`** —
it would reject every write this service makes. So the switch that looks like the answer is the one
switch that must stay off.

Assembling records in exactly one place is what makes this enforceable: there is then no path by
which an unvalidated object literal reaches a PDS. It mirrors what the Ingest already does on the
read side, where a validated record is an invariant of the interface rather than a step someone
remembers.

tangled has no Lexicon validation anywhere and never passes `validate`. We are not copying that,
because we write into other people's repositories under an NSID we published for other clients to
read.

## Likes are keyed by their subject — a deliberate invention

A derived rkey makes a duplicate Like structurally impossible: the same subject always produces the
same rkey, so a second Like is an overwrite. This requires loosening the Like lexicon's `key` from
`tid` to `any`, which is backward compatible — `any` still accepts the TID-shaped rkeys already
written — and `key: "tid"` is in any case enforced by nobody for a third-party NSID.

**Neither reference does this, and one of them deliberately does the opposite.** tangled dropped its
`unique(did, subject)` constraints in a migration commented "remove unique constraints other than
(did, rkey) to handle non-unique atproto records", then added a read-time dedup view for stars only
— so duplicate reactions are normal there and double-count on read. Its one derived rkey is
`vouch`, where the subject is a DID and can be used verbatim. atproto has no precedent for hashing
a subject at-uri into an rkey at all; threadgate and postgate copy their subject's rkey, which works
only because a gate lives in the same repository as the post it gates.

We accept the extra invention because our situation differs in one respect that matters: we publish
an NSID for other clients to read. Tolerating duplicates would leave junk accumulating in strangers'
repositories, and any other AppView reading `com.jjalcloud.feed.like` would double-count it. A
read-time view would hide that from us and from nobody else.

The rkey is hex-encoded, not base32 or base58. rkey syntax is checked for every collection including
third-party ones, and that check includes a slur filter — a hex alphabet cannot trip it.

## Consequences

- Ordinary Likes need no lookup before writing. A repeated Like is simply idempotent.
- **Likes written before this change keep their TID rkeys**, and we cannot clean them up: doing so
  means writing to a repository we only have access to while its owner is logged in. So the Index
  keeps a uniqueness constraint and the unlike path deletes **every** rkey the Index holds for that
  (author, subject), not just the derived one.
- Those rkeys come from the Index, not from walking the author's collection. The current scan is
  worst-case in the common case: it exits early when a Like already exists and walks the entire
  collection when it does not — i.e. every *new* Like pays for the whole collection.
- For that multi-delete, **serial `deleteRecord` calls are safer than one `applyWrites`**: deleting
  a missing record is a 200 no-op on its own but **throws** inside `applyWrites`, surfacing as an
  opaque 500. Batching would convert a harmless race into an error.
- `swapRecord` is not used on deletes. Neither reference does, and the CAS is skipped entirely when
  the record is absent, so it would not provide the guarantee it appears to.
- A client-supplied `subject.cid` is checked against the Index and confirmed with a live `getRecord`
  on mismatch. It is never *sourced* from the Index: tangled derives a cid that way for reply
  parents, by re-marshalling its own copy to CBOR and hashing it, and left a comment noting the
  result fails schema validation when the parent is gone.
- Nothing in the ecosystem reads a strongRef's cid — the official AppView stores it and then dedups
  and aggregates on URI alone. We validate it anyway because the record is written under someone
  else's signature.
- **A blob's mimeType comes from the `uploadBlob` response, not from the client.** The PDS sniffs
  the bytes with `file-type` and the sniffed value wins over the declared one; it then refuses to
  make a blob permanent if the record's BlobRef disagrees with what it sniffed. Trusting
  `file.type` was checking the one value nobody else trusts.
- Image dimensions are read from the GIF header server-side. The PDS does not keep them — it used to
  and abandoned it — and tangled carries no dimensions at all. We need them for grid placeholders,
  and they are in the first ten bytes, so the browser stops being asked.
- GIF rkeys are minted by the PDS. A client-supplied colliding rkey surfaces as an opaque HTTP 500
  because only a swap error is mapped; tangled, which supplies its own rkeys, had to add a
  `getRecord` probe to tell a collision apart from any other failure.
- Update detects "nothing changed" before calling the PDS, and treats a missing `commit` in the
  response as the same thing. `putRecord` answers 200 with no commit and no firehose event when the
  cid is unchanged, so a save that changes nothing is invisible to every indexer downstream.
