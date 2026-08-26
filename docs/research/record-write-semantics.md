# Record write semantics in the official implementations

Research for [#18](https://github.com/huketo/jjalcloud/issues/18). Decision input for
[#6 (레코드 쓰기 정합성 설계)](https://github.com/huketo/jjalcloud/issues/6). Facts only — no decision taken.

## Verdict

The official convention is `createRecord` when the server may mint the rkey (and you want the PDS's
built-in like/follow dedup), `putRecord` + `swapRecord: <cid>` when you own the rkey and are editing,
`swapRecord: null` as the create-guard, and `swapRecord: <cid>` on delete whenever it matters that you
are deleting the thing you read; `applyWrites` is the only atomic multi-record primitive and it has
**no** per-write swap guard. Two of jjalcloud's five write callsites conform: GIF update (correct CAS)
and Like delete (a guardless delete, which is what the reference implementations also do). The other
three do not — GIF create is a `putRecord` that silently clobbers, GIF delete throws away a swap it
already has in hand, and Like create races itself. Separately and more importantly: **no PDS in the
network will ever lexicon-validate a `com.jjalcloud.*` record**, because the reference PDS validates
only against a hardcoded map of `app.bsky.*` / `com.atproto.*` schemas — so client-side validation is
mandatory, not redundant, and the freshness of `subject.cid` is nobody's job unless the AppView makes
it its own.

## Conformance table

| operation | official convention | what jjalcloud does | file:line | conforming? |
| --- | --- | --- | --- | --- |
| GIF create | `createRecord` (server or client rkey, no guard needed — a fresh TID cannot collide), or `putRecord` + `swapRecord: null` if you insist on `putRecord` | client TID + `putRecord`, **no swap at all** → an rkey collision silently overwrites instead of failing | `apps/web/src/routes/gif.tsx:273,287-296` | ❌ no guard; `putRecord` faking a create without `swapRecord: null` is the one shape the reference PDS explicitly can't distinguish from an update |
| GIF update | read `getRecord` → `putRecord` with `swapRecord: <that cid>` | exactly that | `apps/web/src/routes/gif.tsx:332-338,384-392` | ✅ textbook; identical to tangled's edit path |
| GIF delete | `deleteRecord`; `swapRecord` optional but conventional when a cid was just read | `deleteRecord`, no `swapRecord`; also catches a 404 the PDS never returns (delete of a missing record is a **no-op 200**) | `apps/web/src/routes/gif.tsx:424-430` | ⚠️ matches tangled/frontpage practice (they never swap on delete), but the 404 branch is dead code |
| Like create | `createRecord` — and on the reference PDS this is what triggers automatic backlink dedup for like/repost/follow | `createRecord`, preceded by a full `listRecords` scan to dedup by hand | `apps/web/src/routes/like.tsx:80-104,107-115` | ⚠️ right verb, but the hand-rolled scan is a TOCTOU race the official PDS solves server-side — for `com.jjalcloud.*` the PDS will **not** do it for us |
| Like delete | `deleteRecord` (loop) or `applyWrites` with N deletes for atomicity | `deleteRecord` in a loop, no swap, returns its own 404 | `apps/web/src/routes/like.tsx:145-159,161-169` | ✅ conforms to convention; tangled batches the same shape into one `applyWrites` |
| lexicon validation | client validates (`@atproto/lex` `Client.get` always validates responses; `validateRequest` is opt-in) **and** the AppView validates on ingest and skips invalid records | never validates: generated `validateRecord()` exists in `packages/common/src/lexicon/types/**` but every import in `apps/` is `import type` only | `apps/web/src/routes/like.tsx:4`, `apps/indexer/src/index.ts:1-2` | ❌ and the PDS will not cover for us — see §3 |
| rkey source | `tid` key type ⇒ TID; PDS enforces it only for lexicons it knows | `TID.nextStr()` for GIF, server TID for Like; both lexicons declare `"key": "tid"` | `apps/web/src/routes/gif.tsx:273`, `packages/common/lexicons/com/jjalcloud/feed/{gif,like}.json:8` | ✅ correct by construction, unenforced by anyone |

---

## 1. `createRecord` vs `putRecord`

Both end up in the same `prepareWrite` → `processWrites` pipeline, but they differ in five observable ways.

**rkey ownership.** `createRecord.rkey` is optional; when omitted the PDS mints a TID:

```ts
// packages/pds/src/repo/prepare.ts:190-191
const nextRkey = TID.next()
const rkey = opts.rkey || nextRkey.toString()
```

`putRecord.rkey` is `required` in the lexicon (`lexicons/com/atproto/repo/putRecord.json`), so `putRecord`
can never let the server choose.

**Create-vs-update decision.** `putRecord` reads the current record first and branches:

```ts
// packages/pds/src/api/com/atproto/repo/putRecord.ts:101-124
const current = await actorTxn.record.getRecord(uri, null, true)
const isUpdate = current !== null
...
write = isUpdate ? await prepareUpdate(writeInfo) : await prepareCreate(writeInfo)
```

`createRecord` never reads first — it always emits a `WriteOpAction.Create`.

**Collision behaviour.** This is the sharpest difference. A `Create` op reaches `MST.add`, which throws;
a `Update` op reaches `MST.update`, which overwrites:

```ts
// packages/repo/src/repo.ts:127-134
if (write.action === WriteOpAction.Create) {
  const cid = await leaves.add(write.record)
  data = await data.add(dataKey, cid)          // throws if key exists
} else if (write.action === WriteOpAction.Update) {
  data = await data.update(dataKey, cid)       // throws if key is absent
}
```

```ts
// packages/repo/src/mst/mst.ts:238
throw new Error(`There is already a value at key: ${key}`)
```

I ran this against the published `@atproto/repo@0.10.11` rather than trusting the read
(`/tmp/recwrite-exp/mst-collision.mjs`, output verbatim):

```
first add: OK
second add (createRecord semantics) THREW: Error | There is already a value at key: com.jjalcloud.feed.like/3lxyzabcd1234
update missing key (putRecord-as-update) THREW: Error | Could not find a record with key: com.jjalcloud.feed.like/doesnotexist
update existing key (putRecord semantics): OK, root changed = true
```

That thrown value is a **plain `Error`**, and `createRecord`'s handler only maps `BadCommitSwapError`
(`createRecord.ts:111-113`). Everything else falls through to the generic mapper:

```ts
// packages/xrpc-server/src/errors.ts:108-110
if (cause instanceof Error) {
  return new InternalServerError(cause.message, undefined, { cause })
}
```

…and 500s deliberately hide their message (`errors.ts:61-68`, `// Do not respond with error details for 500s`).
So: **`createRecord` with a colliding client-supplied rkey is an opaque HTTP 500, not a 409.** With a
server-minted TID it is unreachable in practice. `docs silent` on whether this is intended.

**What differs when `putRecord` fakes a create.** Three things, all of which bite jjalcloud's GIF create:

1. *No collision error.* Without `swapRecord`, `putRecord` on an existing rkey takes the `prepareUpdate`
   branch and overwrites. The write succeeds and the old record is gone.
2. *No backlink dedup.* `createRecord` — and only `createRecord` — runs the PDS's server-side dedup for
   like/repost/follow-shaped records before writing:
   ```ts
   // packages/pds/src/api/com/atproto/repo/createRecord.ts:93-102
   const backlinkConflicts = validate !== false
     ? await actorTxn.record.getBacklinkConflicts(write.uri, write.record)
     : []
   const backlinkDeletions = backlinkConflicts.map((uri) => prepareDelete({...}))
   const writes = [...backlinkDeletions, write]
   ```
   ```ts
   // packages/pds/src/actor-store/record/reader.ts:214-216
   // @NOTE this logic is a placeholder until we allow users to specify these constraints themselves.
   // Ensures that we don't end-up with duplicate likes, reposts, and follows from race conditions.
   ```
   The trigger list is hardcoded to `app.bsky.graph.follow`, `app.bsky.graph.block` (path `subject`) and
   `app.bsky.feed.like`, `app.bsky.feed.repost` (path `subject.uri`) — `reader.ts:330-371`. **A
   `com.jjalcloud.feed.like` record gets none of this**, which is precisely why `like.tsx` had to grow a
   `listRecords` scan.
3. *`putRecord` can produce a silent no-op.* If the rebuilt record hashes to the cid already stored,
   `putRecord` returns 200 with **no commit and no firehose event**:
   ```ts
   // packages/pds/src/api/com/atproto/repo/putRecord.ts:130-136
   // no-op
   if (current && current.cid === write.cid.toString()) {
     return { commit: null, write }
   }
   ```
   The response's `commit` field is `undefined`. `createRecord` has no such short-circuit. Any AppView
   waiting on the firehose to confirm a `putRecord` will wait forever for an unchanged put.

Minor: rate-limit cost differs — `createRecord` charges 3 points, `putRecord` 2, `deleteRecord` 1
(`createRecord.ts:35-46`, `putRecord.ts:44-55`, `deleteRecord.ts:32-43`).

## 2. `swapRecord` / `swapCommit`

Both are compare-and-swap preconditions; they differ in scope. `swapCommit` compares the **whole repo
head** and is available on `createRecord`, `putRecord`, `deleteRecord` and `applyWrites`. `swapRecord`
compares **that one record's cid** and exists only on `putRecord` and `deleteRecord`.

```ts
// packages/pds/src/actor-store/repo/transactor.ts:113-116
if (swapCommit && !currRoot.cid.equals(swapCommit)) {
  throw new BadCommitSwapError(currRoot.cid)
}
```

`swapRecord: null` **is** the documented create-guard — the lexicon marks the field `"nullable"` and the
transactor gives `null` a distinct meaning from "absent":

```jsonc
// lexicons/com/atproto/repo/putRecord.json
"nullable": ["swapRecord"],
"swapRecord": {
  "type": "string", "format": "cid",
  "description": "Compare and swap with the previous record by CID. WARNING: nullable and optional field; may cause problems with golang implementation"
}
```

```ts
// packages/pds/src/actor-store/repo/transactor.ts:142-160
if (swapCid !== undefined) {
  if (action === WriteOpAction.Create && swapCid !== null) throw new BadRecordSwapError(currRecord)
  if (action === WriteOpAction.Update && swapCid === null) throw new BadRecordSwapError(currRecord)
  if (action === WriteOpAction.Delete && swapCid === null) throw new BadRecordSwapError(currRecord)
  if ((currRecord || swapCid) && !(swapCid && currRecord && currRecord.equals(swapCid))) {
    throw new BadRecordSwapError(currRecord)
  }
}
```

So the three states are: **absent** = "I don't care", **`null`** = "this MUST be a create", **`<cid>`** =
"this MUST be an update/delete of exactly that version". Confirmed by the reference test, which deletes
the profile first specifically so it can exercise the null case:

```ts
// packages/pds/tests/crud.test.ts:1105-1118
// Start with missing profile record, to test swapRecord=null
await repo.deleteRecord({ ... rkey: 'self' })
// Test swapRecord w/ null (ensures create)
const { data: profile1 } = await repo.putRecord({ ..., swapRecord: null, record: profileRecord() })
```

```ts
// packages/pds/tests/crud.test.ts:1141-1149
// Test swapRecord w/ null (ensures create)
const attemptPut1 = repo.putRecord({ ..., swapRecord: null, record: profileRecord() })
await expect(attemptPut1).rejects.toMatchObject({ error: 'InvalidSwap' })
```

**On delete: convention, not requirement.** `deleteRecord.swapRecord` is optional in the lexicon and the
PDS honours it when present (`deleteRecord.ts:67,73`), with a dedicated test at
`crud.test.ts:1013-1060` ("deleteRecord succeeds on proper record cas" / "fails on bad record cas").
But neither tangled nor frontpage ever passes it on a delete — see §7. So: supported and meaningful,
conventionally omitted.

**Delete of a missing record is a no-op, not a 404:**

```ts
// packages/pds/src/api/com/atproto/repo/deleteRecord.ts:76-79
const record = await actorTxn.record.getRecord(write.uri, null, true)
if (!record) {
  return null // No-op if record already doesn't exist
}
```

It returns HTTP 200 with `commit: undefined`. jjalcloud's `gif.tsx:426-428` 404 branch is unreachable
via this path.

**Error shape on mismatch.** Both swap failures become the same wire error:

```ts
throw new InvalidRequestError(err.message, 'InvalidSwap')   // putRecord.ts:145, deleteRecord.ts:88
```

`InvalidRequestError` is `ResponseType.InvalidRequest` = **HTTP 400**, and the body is
`{ error, message }` (`xrpc-server/src/errors.ts:61-68`). The messages come from the error classes:

```ts
// packages/pds/src/repo/types.ts:55-65
export class BadCommitSwapError extends Error { constructor(public cid: Cid) { super(`Commit was at ${cid.toString()}`) } }
export class BadRecordSwapError extends Error { constructor(public cid: Cid | null) { super(`Record was at ${cid?.toString() ?? 'null'}`) } }
```

So a failed CAS is exactly:

```
HTTP 400
{"error":"InvalidSwap","message":"Record was at bafyrei..."}     // or "Record was at null"
{"error":"InvalidSwap","message":"Commit was at bafyrei..."}
```

Note `"Record was at null"` is what you get back when you sent `swapRecord: <cid>` for a record that
does not exist, and `"Record was at bafy..."` when you sent `swapRecord: null` for one that does.

**atcute supports this today.** `@atcute/atproto@4.0.4` types `putRecord.swapRecord` as nullable and
`deleteRecord.swapRecord` as an optional string:

```ts
// node_modules/@atcute/atproto/dist/lexicons/types/com/atproto/repo/putRecord.js:28
swapRecord: v.optional(v.nullable(v.cidString())),
// .../deleteRecord.js:17
swapRecord: v.optional(v.cidString()),
```

There is no client-side blocker to adopting `swapRecord: null` in `gif.tsx`.

## 3. What `validate` actually validates — and why client validation is mandatory for us

`validate` is tri-state, documented in the lexicon itself: *"Can be set to 'false' to skip Lexicon schema
validation of record data, 'true' to require it, or leave unset to validate only for known Lexicons."*

The whole implementation is one function:

```ts
// packages/pds/src/repo/prepare.ts:64-106
const validateRecord = (record, rkey, opts) => {
  if (opts.validate === false) return undefined
  // @TODO add support for lexicon resolution to fetch the schema dynamically
  const schema = knownSchemas.get(record.$type)
  if (!schema) {
    if (opts.validate === true) throw new InvalidRecordError(`Unknown lexicon type: ${record.$type}`)
    else return 'unknown'
  }
  const rkeyResult = schema.keySchema.safeValidate(rkey)
  if (!rkeyResult.success) throw new InvalidRecordError(`Invalid record key for ${record.$type}: ...`)
  const recordResult = schema.safeValidate(record, { path: opts.validationPath ?? ['record'] })
  if (!recordResult.success) throw new InvalidRecordError(`Invalid ${record.$type} record: ...`)
  return 'valid'
}
```

`knownSchemas` is a **hardcoded 20-entry map** built at module load (`prepare.ts:39-62`): the
`app.bsky.*` records, `chat.bsky.actor.declaration`, `com.atproto.lexicon.schema`,
`com.germnetwork.declaration`. There is no dynamic resolution — the `@TODO` above says so explicitly.
The PDS does construct a `LexResolver`, but it is a constructor argument of `new OAuthProvider({...})`
(`packages/pds/src/context.ts:346-347,369-379`), i.e. it serves OAuth scope/permission-set resolution,
not record writes.

Consequences for an NSID the PDS does not know, i.e. every `com.jjalcloud.*` record:

| `validate` | outcome for an unknown NSID |
| --- | --- |
| unset (default) | write succeeds, **nothing validated**, response carries `validationStatus: "unknown"` |
| `true` | write **rejected**: HTTP 400 `{"error":"InvalidRequest","message":"Unknown lexicon type: com.jjalcloud.feed.gif"}` |
| `false` | write succeeds, nothing validated, `validationStatus` omitted entirely |

Verbatim from the reference tests:

```ts
// packages/pds/tests/crud.test.ts:676-703
it('disallows creation of unknown lexicons when validate is set to true', async () => {
  const attempt = aliceAgent.com.atproto.repo.createRecord({ validate: true, collection: 'com.example.record', record: { blah: 'thing' } })
  await expect(attempt).rejects.toMatchObject({ error: 'InvalidRequest', message: expect.stringContaining('com.example.record') })
})
it('allows creation of unknown lexicons when validate is not set to true', async () => {
  const res1 = await aliceAgent.com.atproto.repo.createRecord({ collection: 'com.example.record', record: { blah: 'thing1' } })
  expect(res1.data.validationStatus).toBe('unknown')
```

So `validate: true` is actively harmful for us — it would reject every one of our own records. What
*is* still enforced regardless of `validate`, for every collection: the `$type` must equal the
collection (`prepare.ts:167-178`, test at `crud.test.ts:608-618`), the rkey must satisfy generic
record-key syntax and the slur filter (`prepare.ts:181-188`), no legacy blob refs
(`prepare.ts:203-212`), and the record must round-trip through DRISL CBOR (`crud.test.ts:1206`).

**Therefore client-side lexicon validation is mandatory, not redundant** — nothing between the browser
and the Index will ever check that a `com.jjalcloud.feed.gif` has a `file` blob. The official stack
puts validation in two places we currently have neither of:

- *Client, opt-in on write and always-on on read.* `@atproto/lex`'s `Client` defaults
  `validateRequest: false` (`packages/lex/lex-client/src/client.ts:434`) but `Client.get` always
  validates the response, and `Client.create` always checks the rkey against the schema's key type:
  ```ts
  // client.ts:1034-1038
  const record = schema.build(input)
  if (options?.validateRequest) schema.validate(record)
  const rkey = options.rkey ?? getDefaultRecordKey(schema)
  if (rkey !== undefined) schema.keySchema.assert(rkey)
  // client.ts:1106
  const value = schema.validate(response.body.value)
  ```
- *AppView, mandatory on ingest.* Every indexer asserts the record against its lexicon before inserting,
  and the firehose consumer drops what fails:
  ```ts
  // packages/bsky/src/data-plane/server/indexing/processor.ts:62-63,73
  assertValidRecord(obj: unknown): asserts obj is l.InferInput<TSchema> { this.options.schema.check(obj) }
  ...
  async insertRecord(uri, cid, obj, timestamp, opts?) { this.assertValidRecord(obj) ... }
  ```
  ```ts
  // packages/bsky/src/data-plane/server/indexing/index.ts:203-208
  } catch (err) {
    if (err instanceof l.LexValidationError) {
      subLogger.warn({ did, commit, uri, cid }, 'skipping indexing of invalid record')
  ```
  This matters doubly for jjalcloud because `TAP_SIGNAL_COLLECTION` auto-adopts repos network-wide: the
  Index will receive `com.jjalcloud.*` records written by arbitrary clients that never touched our code,
  and no PDS filtered them.

jjalcloud already ships the validators and never calls them —
`packages/common/src/lexicon/types/com/jjalcloud/feed/like.ts:31-33` exports `validateMain` /
`validateRecord`, but every consumer (`apps/web/src/routes/like.tsx:4`,
`apps/indexer/src/index.ts:1-2`, `apps/indexer/src/backfill.ts:2-3`) imports `type` only.

## 4. `applyWrites`

**Atomicity: whole-call, all-or-nothing.** Every write is prepared first, then a single
`actorStore.transact` produces exactly one commit and one firehose event:

```ts
// packages/pds/src/api/com/atproto/repo/applyWrites.ts:127-160
preparedWrites = await Promise.all(writes.map(async (write, i) => { ... prepareCreate/Update/Delete ... }))
...
// :167-179
const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
  const commit = await actorTxn.repo.processWrites(preparedWrites, swapCommitCid).catch(...)
  await ctx.sequencer.sequenceCommit(did, commit)
  return commit
})
```

**Partial failure does not exist.** Preparation happens *before* the transaction, so a validation error
in write #7 rejects the whole call with nothing written (`applyWrites.ts:161-166` → `InvalidRequestError`).
Inside the transaction, any MST-level failure aborts the transaction. In particular, because
`applyWrites#delete` goes through `MST.delete`, **deleting a nonexistent record inside `applyWrites`
throws**, whereas standalone `deleteRecord` no-ops. Verified against `@atproto/repo@0.10.11`
(`/tmp/recwrite-exp/mst-delete.mjs`):

```
delete missing key THREW: Error | Could not find a record with key: com.jjalcloud.feed.like/nope
```

And like the create collision, that is a plain `Error` → opaque HTTP 500. This is a live footgun for a
"unlike everything matching this subject" batch built from a possibly-stale read.

**Limits.** Two hard caps, enforced twice:

```ts
// packages/pds/src/api/com/atproto/repo/applyWrites.ts:85-87
if (writes.length > 200) throw new InvalidRequestError('Too many writes. Max: 200')
```
```ts
// packages/pds/src/actor-store/repo/transactor.ts:83-92
if (writes.length > 200) throw new InvalidRequestError('Too many writes. Max: 200')
const commit = await this.formatCommit(writes, swapCommitCid)
if (commit.relevantBlocks.byteSize > 2000000) throw new InvalidRequestError('Too many writes. Max event size: 2MB')
```

Plus a 1 MB JSON body limit (`opts: { jsonLimit: 1_000_000 }`, `applyWrites.ts:69`) and rate-limit points
of 3/2/1 per create/update/delete (`applyWrites.ts:20-36`).

**Swap compatibility: `swapCommit` only.** The `applyWrites` lexicon has `swapCommit` at the top level
and **no `swapRecord` on any of `#create` / `#update` / `#delete`**
(`lexicons/com/atproto/repo/applyWrites.json`). The handler never populates `swapCid`, and only maps
`BadCommitSwapError` (`applyWrites.ts:173-175`). So you can guard a batch against concurrent repo
mutation, but you cannot express "delete this like only if it is still at cid X" inside a batch. Test:
`crud.test.ts:1161-1204`.

Output is per-write: `results: [{ $type: '...#createResult', uri, cid, validationStatus }, ...]`,
order-preserving (`applyWrites.ts:195-226`, and the `@NOTE should preserve order` comment at :123).

## 5. strongRef: who owns `subject.cid`?

`com.atproto.repo.strongRef` is just `{ uri, cid }`, both required, described as *"A URI with a
content-hash fingerprint."* `app.bsky.feed.like` uses it for `subject` and (optionally) `via`, with
`"key": "tid"`.

**On write, nobody checks it.** `app.bsky.feed.like` *is* in the PDS's `knownSchemas`, so the PDS
validates that `subject.cid` parses as a cid — and stops there. It never fetches the subject, and the
subject usually lives in a different repo anyway.

**On ingest, the official AppView stores it and never compares it:**

```ts
// packages/bsky/src/data-plane/server/indexing/plugins/like.ts:25-39
.insertInto('like').values({
  uri: uri.toString(), cid: cid.toString(), creator: uri.host,
  subject: obj.subject.uri,
  subjectCid: obj.subject.cid,
  ...
}).onConflict((oc) => oc.doNothing())
```

Dedup is by subject **uri**, cid ignored:

```ts
// packages/bsky/src/data-plane/server/indexing/plugins/like.ts:44-56
const found = await db.selectFrom('like')
  .where('creator', '=', uri.host)
  .where('subject', '=', obj.subject.uri)
```

The like count aggregate likewise joins on uri only:

```ts
// packages/bsky/src/data-plane/server/indexing/plugins/like.ts:123-135
.values({ uri: like.subject, likeCount: db.selectFrom('like').where('like.subject', '=', like.subject).select(countAll...) })
```

Across the whole `packages/bsky/src` tree, `subjectCid` appears only in the like/repost insert rows and
in quote-post bookkeeping (`plugins/post.ts:207,224,493`); there is no read path that compares a like's
`subjectCid` against the current post cid.

**So: what happens when a client submits a stale cid to `app.bsky.feed.like`? Nothing. The write
succeeds, the AppView indexes it, the like counts, the notification fires.** No layer of the official
stack ever rejects it. The cid is a provenance fingerprint — "this is the version I saw" — not a
precondition.

Frontpage is the counter-example and shows this is a per-AppView choice. Its post-vote path *does*
require the cid to match its indexed copy, on both the optimistic write and the firehose ingest:

```ts
// apps/frontpage/lib/data/db/vote.ts:110-125
.where(and(
  eq(schema.Post.rkey, subject.rkey),
  eq(schema.Post.authorDid, subject.authorDid),
  eq(schema.Post.cid, subject.cid),
))
...
invariant(post, `Post not found with rkey: ${subject.rkey} repo: ${subject.authorDid} cid: ${subject.cid}`)
```

…and the same `createPostVote` is what the relay hook calls (`app/api/receive_hook/handlers.ts:364-373`),
so a stale-cid vote arriving over the firehose throws and is not indexed. Frontpage is inconsistent with
itself, though — `createCommentVote` matches on rkey + author and **drops the cid check**
(`vote.ts:161-170`). Tangled sidesteps the question entirely: `sh.tangled.feed.reaction.subject` is a
bare `at-uri` string with no cid at all (`lexicons/feed/reaction.json`).

For reference, jjalcloud's `com.jjalcloud.feed.like.subject` is a `com.atproto.repo.strongRef`
(`packages/common/lexicons/com/jjalcloud/feed/like.json`), and `like.tsx:97-104` copies whatever
`subject.cid` the browser posted straight into the record without any check that it is a real GIF, let
alone the current one.

## 6. rkey rules

**TID is conventional at the protocol level and enforced only per-lexicon.** The spec lists four key
types — `tid`, `nsid`, `literal:<value>`, `any` — and says *"Every record Lexicon schema will indicate
which of the record key types should be used"*
([atproto.com/specs/record-key](https://atproto.com/specs/record-key)). The PDS enforces the declared
type via `schema.keySchema.safeValidate(rkey)` (`prepare.ts:88-93`) — but only inside the `if (schema)`
branch, i.e. **only for the 20 lexicons it has hardcoded.** For `com.jjalcloud.*` the declared
`"key": "tid"` is enforced by nobody server-side.

**Baseline syntax applies to every rkey regardless of type**, and the implementation matches the spec
one-to-one:

```ts
// packages/syntax/src/recordkey.ts:3-6
const RECORD_KEY_MAX_LENGTH = 512
const RECORD_KEY_MIN_LENGTH = 1
const RECORD_KEY_INVALID_VALUES = new Set(['.', '..'])
const RECORD_KEY_REGEX = /^[a-zA-Z0-9_~.:-]{1,512}$/
```

- ASCII alphanumerics plus `. - _ : ~`, 1–512 chars, case-sensitive, `.` and `..` banned.
- Spec-valid examples: `3jui7kd54zh2y`, `self`, `example.com`, `~1.2-3_`, `dHJ1ZQ`, `pre:fix`, `_`.
- Invalid: `alpha/beta`, `#extra`, `@handle`, `any space`, `any+space`, `dHJ1ZQ==`.
- Spec best practice: keep the whole `<collection>/<rkey>` path under 80 chars; prefer lowercase.
- The PDS adds a slur filter on top: `hasExplicitSlur(opts.rkey)` → `InvalidRecordError`
  (`prepare.ts:185-187`).
- `(did, rkey)` is **not** unique; `(did, collection, rkey)` is.

**A custom rkey is legitimate when the lexicon says so.** `literal:self` for singletons (jjalcloud
already uses this shape for `app/bsky/actor/profile.json:5`), `nsid`, or `any` when the key itself
carries meaning — the spec calls this out: *"This may be used to encode semantics in the name … This
enables de-duplication and known-URI lookups."* That is the protocol-blessed way to make a like
idempotent by construction: an `any`-keyed collection whose rkey is derived from the subject, so a
double-like is a same-key write rather than a second record. It costs you the chronological MST locality
TIDs buy (see the repository spec's note on appends vs random insertions) and requires a lexicon change.

The spec's own warning is worth transcribing given `TAP_SIGNAL_COLLECTION`: *"Record keys are
'user-controlled data' and may be arbitrarily selected by hostile accounts."* Repository paths are also
a documented DoS surface via key mining ([atproto.com/specs/repository](https://atproto.com/specs/repository),
"Security Considerations").

## 7. What the small implementations actually do

**tangled** (`838c81a`, Go). Overwhelmingly `putRecord` with a client-generated TID; it barely uses
`createRecord` at all (two callsites, both in one-off migrations).

- *Create*: `Rkey: tid.TID()` then `RepoPutRecord` with **no swap**
  (`appview/state/reaction.go:53,72-79`). Same shape as jjalcloud's GIF create.
- *Update*: read existing → `RepoPutRecord{ SwapRecord: ex.Cid }`. This is systematic — 20+ callsites
  (`appview/issues/issues.go:311`, `appview/repo/repo.go:167,285,407,504,592,1087,1129`,
  `appview/pulls/edit.go:81`, `appview/state/comment.go:396`, `appview/state/profile.go:974,1205,1282`,
  `appview/strings/strings.go:318`, …). Identical to jjalcloud's GIF update.
- *Delete*: **never** carries `SwapRecord` — zero of the `RepoDeleteRecord_Input{}` literals set it
  (grep across `appview/`).
- *Batch unlike*: one `RepoApplyWrites` with N `#delete` elements and no `swapCommit`
  (`appview/state/reaction.go:119-131`) — the batched version of jjalcloud's `like.tsx` delete loop.
- *DB-first ordering*: tangled opens its local transaction, writes the DB, writes the PDS, then commits,
  with an explicit comment that the ingester backfills if the commit fails
  (`reaction.go:59-89`). It treats the PDS as the source of truth and its own DB as reconstructible.

**frontpage** (`f23106d`, TypeScript). Uses the typed `@atproto/lex` `Client` rather than raw XRPC.

- *Create*: `const rkey = TID.next().toString()` then `atproto.create(fyi.unravel.frontpage.vote, record, { rkey, repo })`
  (`apps/frontpage/lib/api/vote.ts:27,69-72`) — which is `createRecord` with a client rkey, no swap, and
  `validateRequest` left at its `false` default. Note the in-repo TODO at `vote.ts:59-60`: *"We should
  create this up front to take advantage of validation"* — they know they are skipping write validation.
- *Delete*: `atproto.delete(fyi.unravel.frontpage.vote, { repo, rkey })` (`vote.ts:90-93`) — no swap.
- *Read/ingest validation*: `atproto.get(...)` at `handlers.ts:329-331`, and `Client.get` always runs
  `schema.validate()` (`client.ts:1106`). So frontpage does validate — on read, not on write.
- *Local-first, then PDS*: it inserts a `status: "pending"` row, fires the PDS write in `after()`, and
  the firehose hook later flips it to `"live"` (`vote.ts:29-73`, `handlers.ts:352-380`); failure rolls
  the local row back (`vote.ts:74-77`).

Neither project uses `swapRecord: null`. Neither swaps on delete. Both hand-roll the "did I already
like this?" question in their own DB rather than relying on the PDS.

## 8. Sources and versions

| what | version / commit |
| --- | --- |
| `bluesky-social/atproto` | `ea95a97c620ba062b6c2ad531a202ece61316e89` (2026-08-26); `packages/pds` 0.5.29 |
| `tangled` (`https://tangled.sh/@tangled.sh/core`) | `838c81a58e1b362c28c59d4db221fe47da8424cf` (2026-08-26) |
| `likeandscribe/frontpage` | `f23106d0848c90fb7fa741cfebf1f8680f09b874` (2026-07-25) |
| `@atproto/repo` (npm, used for the two experiments) | 0.10.11 |
| `@atcute/atproto` (npm, swap-field typing check) | 4.0.4 |
| specs | [record-key](https://atproto.com/specs/record-key), [repository](https://atproto.com/specs/repository) |

Experiments were run in `/tmp/recwrite-exp` against the published `@atproto/repo`; both scripts and their
verbatim output are reproduced inline in §1 and §4. No repo file other than this one was created or
modified, and no git command was run.

## What this decides / does not decide

**Unblocks [#6 (레코드 쓰기 정합성 설계)](https://github.com/huketo/jjalcloud/issues/6)** with the five facts it
was waiting on: `swapRecord: null` is a real, tested create-guard and atcute can already send it;
`applyWrites` is atomic but offers `swapCommit` only, capped at 200 writes / 2 MB / 1 MB JSON; delete of
a missing record no-ops on `deleteRecord` but **throws** inside `applyWrites`; the PDS's like/follow
dedup is hardcoded to `app.bsky.*` and will never fire for us; a stale `subject.cid` is rejected by
nothing, anywhere, in the official stack.

**Reshapes the lexicon-validation work** (the "no lexicon validation on read or write" defect): this is
not a nice-to-have. The reference PDS validates against a hardcoded 20-schema map with an open `@TODO`
for dynamic resolution, so `validate: true` would *reject* every `com.jjalcloud.*` write and the default
gives us `validationStatus: "unknown"` and zero checking. The two places the official stack puts
validation — the client before write, and the AppView on ingest (`'skipping indexing of invalid record'`)
— are exactly the two places jjalcloud currently has none, while `TAP_SIGNAL_COLLECTION` guarantees the
Index receives records written by clients we do not control.

**Reshapes the Like design.** `like.tsx`'s `listRecords` scan is jjalcloud hand-implementing
`getBacklinkConflicts`, which the PDS does server-side and race-free — but only for `app.bsky.*`. The
protocol-native alternative is a derived rkey under an `any`-keyed lexicon, which makes double-liking a
same-key write instead of a second record; that is a lexicon change and a trade against TID locality.

**Hands to a human, three questions this research cannot settle:**

1. Should `com.jjalcloud.feed.like` keep `"key": "tid"` + application-level dedup (bsky/tangled/frontpage's
   choice), or move to a subject-derived rkey so idempotency is structural? Both are protocol-legal; the
   second is a breaking lexicon change and forfeits chronological MST ordering.
2. Is a stale `subject.cid` an error for jjalcloud? bsky says no, frontpage says yes for posts and no for
   comments. Rejecting stale cids means an editable GIF record invalidates its own likes on every edit.
3. Do we adopt `swapRecord` on delete? Nobody in the reference set does, and it costs a `getRecord`
   round trip per delete — but our GIF delete already has an rkey the user could have edited under a
   concurrent tab.
