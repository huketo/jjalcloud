---
status: accepted
---

# OAuth asks for two collections, not the repository

The requested scope becomes:

```
atproto
repo:com.jjalcloud.feed.gif
repo:com.jjalcloud.feed.like
blob:image/gif
```

`transition:generic` is removed entirely. No read scopes are requested, because none exist to
request.

Everything below marked **source** was read directly in `~/marimba/atproto` at `6a7eff7a7`
(`@atproto/oauth-scopes` 0.5.8, `@atproto/oauth-provider` 0.21.2, `@atproto/pds` 0.5.24). The one
thing that is **not** verifiable from source is called out at the end, and it is why a manual
verification task blocks the cutover.

## Why this is the whole of the narrowing

Narrowing by *action* turns out to buy nothing, which was a surprise:

- **source** — `putRecord` asserts `create` **and** `update`, unconditionally and with no branch:
  `packages/pds/src/api/com/atproto/repo/putRecord.ts:83-90`. Likes are written with `putRecord`
  (ADR-0008), so they need both.
- Editing a GIF is read-then-`putRecord` with a swap (ADR-0008), so GIFs need `update` too, and both
  collections need `delete`.
- **source** — `REPO_ACTIONS` is exactly `['create','update','delete']` and the `action` parameter is
  `required: false` with `default: REPO_ACTIONS`
  (`packages/oauth/oauth-scopes/src/scopes/repo-permission.ts:15-19` and its parser block).

So the set we need *is* the default set, and spelling out actions would add noise without removing
permission. The real narrowing is by **collection**: from every collection in the user's repository —
their posts, follows, likes, profile, blocks — down to the two we write.

**source** — `collection` is `required: true` and accepts only `'*'` or an exact NSID
(`isCollectionParam`, same file). There are **no prefix globs**, so `com.jjalcloud.*` is not
expressible; each collection is listed.

## No read scopes exist to ask for

**source** — `getRecord` and `listRecords` contain no reference to `auth`, `credentials`,
`authVerifier` or `assertRepo`, and `lexicons/com/atproto/repo/{getRecord,listRecords}.json` carry no
`auth` key. Reading a public record — including the cross-user read that confirms a strongRef cid —
needs neither a token nor a scope. Profile reads left the picture entirely when profiles moved to
firehose indexing (ADR-0009).

## `transition:generic` cannot stay alongside

**source** — `scope-permissions-transition.ts` overrides `allowsRepo` and `allowsBlob` to
`return true` whenever `hasTransitionGeneric`. Keeping it as a safety net would silently disable
every narrow permission, so there is no partial adoption and no fallback-by-coexistence. It goes, or
nothing changes.

## `blob:image/gif` is a declaration, not the enforcement

**source** — `accept` is `required: true` on `BlobPermission`
(`scopes/blob-permission.ts:38-40`), so a bare `blob` is invalid; the value supports `*/*`, `type/*`,
or an exact type.

We ask for `image/gif` knowing the check is imperfect: the PDS matches the scope against the
**client-declared** `Content-Type` while storing the type it sniffed from the bytes. The scope is the
promise shown on the consent screen; the actual guard is ADR-0008's rule that we read the sniffed
`mimeType` back from the `uploadBlob` response before writing a record.

## What is not verified, and what we do about it

The scope grammar is implemented and enforced in the reference PDS, and indigo carries an independent
Go implementation. **That does not establish that `bsky.social` issues and enforces these scopes
today**, and two source facts say we cannot infer it:

- **source** — `scopes_supported` in the authorization-server metadata is a hardcoded four-element
  array, commented "Other atproto scopes can't be enumerated as they are dynamic"
  (`packages/oauth/oauth-provider/src/metadata/build-metadata.ts:28-38`). Its contents are evidence
  of nothing.
- **source** — client-metadata validation checks only that a scope is present, contains `atproto`,
  and has no duplicates; there is no per-value allowlist (`client-manager.ts:261-274`).
- **source** — on entryway-backed deployments, which `bsky.social` is, an access token may carry an
  opaque `ref:<cid>` that the PDS dereferences via `com.atproto.temp.dereferenceScope` with a 1-day
  Redis cache (`packages/pds/src/account-manager/scope-reference-getter.ts:19-22,68-95`). The path
  differs from a self-hosted PDS.

Probing confirmed the gap rather than closing it: PAR and the authorization endpoint both accepted a
deliberately bogus scope, and scopes the source rejects as invalid, all the way to a login page. **An
invalid scope does not fail at login — it fails later, when a write is attempted.** That is the worse
failure mode, and it is why the authorization server cannot be used as a syntax checker.

Consequence: a manual end-to-end verification on staging — real account, real consent screen, real
upload — blocks the cutover. And it must happen *before* cutover regardless, because a scope change
only rides for free on the re-authentication that cutover already forces; afterwards, changing it
costs every user a fresh consent.
