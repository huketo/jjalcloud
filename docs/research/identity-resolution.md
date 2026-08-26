# Identity resolution: DID documents, PDS endpoints, and handle re-resolution

Research for [#20](https://github.com/huketo/jjalcloud/issues/20). Serves two decision tickets:
[#5 blob PDS resolution and image delivery](https://github.com/huketo/jjalcloud/issues/5) and
[#11 source of truth for profile data](https://github.com/huketo/jjalcloud/issues/11). Every
section is tagged with the ticket it serves.

Sources are pinned to `bluesky-social/atproto` @ `ea95a97`, `mary-ext/atcute` @ `f05b92f`,
`likeandscribe/frontpage` @ `f23106d`, `tangled` core @ `knot1.tangled.sh`, published
`@atcute/identity@2.0.2` / `@atcute/identity-resolver@2.0.1` / `@atcute/identity-resolver-node@2.0.1`,
and `@atproto/common-web@0.5.9`. Live probes were run 2026-08-26.

---

## Verdict

**Do not denormalise the PDS endpoint onto `gifs` rows.** When a user migrates, the old PDS
deactivates their account and *stops serving their blobs entirely* — `getBlob` there returns
`400 RepoDeactivated`, not a redirect, not a 404 — so a per-row PDS host does not merely go stale,
it becomes a hard, permanent break for every image that user ever posted. Denormalise the endpoint
**per DID** instead (one `users`-style row, or a cache keyed by DID), resolved from the DID document
and invalidated on tap's `identity` event; the blob CID and the record's at-uri survive migration
unchanged, so the DID + CID already on the row is all the durable identity a blob URL needs.

Proof, end to end, in one command — the account `did:plc:44ybard66vv44zksje25o7dz` migrated from
Bluesky to a self-hosted PDS on 2025-06-06:

```console
$ curl -sSL "https://bsky.social/xrpc/com.atproto.sync.getBlob?did=did:plc:44ybard66vv44zksje25o7dz&cid=bafkreiglnysron3h2je7nf6cmvtimuaxi7xe2c7rkxitmks3mzmajnc2ou"
{"error":"RepoDeactivated","message":"Repo has been deactivated: did:plc:44ybard66vv44zksje25o7dz"}
final_url=https://morel.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=...&cid=...
status=400

$ curl -sS -o /dev/null -w 'status=%{http_code} bytes=%{size_download}\n' \
    "https://pds.robocracy.org/xrpc/com.atproto.sync.getBlob?did=did:plc:44ybard66vv44zksje25o7dz&cid=bafkreiglnysron3h2je7nf6cmvtimuaxi7xe2c7rkxitmks3mzmajnc2ou"
status=200 bytes=106760
```

Same DID, same CID. The host is the only thing that changed, and it is the only thing we must not
freeze. Note also that this is exactly the failure mode of the hardcoded `bsky.social` in
`apps/web/src/utils/gifUrl.ts:62` — Bluesky's *entryway* denormalises the PDS host too, and it is
wrong for this account.

---

## 1. PDS migration: what changes, what survives — serves #5 and #11

### What the DID document changes

Migration rewrites two fields and leaves the rest alone. From the account-migration guide
(<https://atproto.com/guides/account-migration>), the identity update carries "the requested DID
fields (new signing key, rotation keys, PDS location, etc)".

Observed on a real migration — the full PLC audit log for `did:plc:44ybard66vv44zksje25o7dz`
(`curl https://plc.directory/did:plc:44ybard66vv44zksje25o7dz/log/audit`):

| createdAt | `alsoKnownAs` | `services.atproto_pds.endpoint` |
| --- | --- | --- |
| 2023-11-06 | `at://bnewbold.net` | `https://morel.us-east.host.bsky.network` |
| 2025-06-05 | `at://bnewbold.net` | `https://morel.us-east.host.bsky.network` |
| **2025-06-06** | `at://bnewbold.net` | **`https://pds.robocracy.org`** |

The 2025-06-06 operation changed `services.atproto_pds.endpoint`, `verificationMethods.atproto`
(the signing key) **and** `rotationKeys`. The handle did not move. This pairing is not a
coincidence — see §4.

### What happens to already-indexed records

Nothing. They stay valid.

- The repository is moved as a CAR file (`com.atproto.sync.getRepo` → `com.atproto.repo.importRepo`),
  so the DID, collection, rkey and record CIDs are all preserved. The migration test asserts
  `indexedRecords: 103` on the *new* PDS after importing the old repo
  (`packages/pds/tests/account-migration.test.ts:136-140`).
- The at-uri is `at://<did>/<collection>/<rkey>` and the DID is immutable. No at-uri changes.

So the Index is not invalidated by a migration. **Only the derived PDS host is.** [INFERENCE, but
directly implied by the CAR-import mechanism above.]

### What happens to already-built blob URLs

They break, permanently, unless the host is recomputed.

- Blobs are re-uploaded to the new PDS **under the same CID** — the guide says recovered blobs
  "can be uploaded later (if the blob CIDs match exactly)", and CIDs are content hashes
  (<https://atproto.com/specs/blob>, "Blob Metadata").
- The old PDS is deactivated as the last step: "The user can activate their account on the new PDS
  with a call to `com.atproto.server.activateAccount`, and deactivate their account on the old PDS
  with `com.atproto.server.deactivateAccount`."

### Does the old PDS keep serving blobs? No.

This is the decisive fact, and it is enforced in three independent places:

1. **Spec.** "When an account is deactivated, takendown, or suspended, blobs should not be publicly
   accessible." — <https://atproto.com/specs/blob>, Blob Lifecycle.
2. **Migration guide.** "When accessing blobs from a 'deactivated' account the request must be
   authenticated using the account from that PDS, otherwise you cannot access them."
3. **Reference implementation.** `getBlob` calls `assertRepoAvailability`, which throws for anyone
   who is not the account holder or an admin:

```ts
// atproto/packages/pds/src/api/com/atproto/sync/util.ts:30-35
  if (account.deactivatedAt) {
    throw new InvalidRequestError(
      `Repo has been deactivated: ${handleOrDid}`,
      'RepoDeactivated',
    )
  }
```

Live confirmation of the hosting status on both sides:

```console
$ curl -sS "https://morel.us-east.host.bsky.network/xrpc/com.atproto.sync.getRepoStatus?did=did:plc:44ybard66vv44zksje25o7dz"
{"did":"did:plc:44ybard66vv44zksje25o7dz","active":false,"status":"deactivated"}
$ curl -sS "https://pds.robocracy.org/xrpc/com.atproto.sync.getRepoStatus?did=did:plc:44ybard66vv44zksje25o7dz"
{"did":"did:plc:44ybard66vv44zksje25o7dz","active":true,"rev":"3mtxoy4od722j"}
```

Note the failure is a `400` with an error body, **not** a 404 and **not** a redirect. A cache that
only invalidates on 404 will never notice.

### What the reference AppView does about this

Bluesky's own AppView resolves the PDS at request time, on every blob fetch, and never stores it
in the URL:

```ts
// atproto/packages/bsky/src/api/blob-resolver.ts:247-292
async function getBlobUrl(dataplane, did, cid): Promise<URL> {
  const pds = await getBlobPds(dataplane, did, cid)
  const url = new URL(`/xrpc/com.atproto.sync.getBlob`, pds)
  ...
}
async function getBlobPds(dataplane, did, cid): Promise<string> {
  const [identity, { takenDown }] = await Promise.all([
    dataplane.getIdentityByDid({ did }).catch(...),
    dataplane.getBlobTakedown({ did, cid: cid.toString() }),
  ])
  ...
  const pds = services && getServiceEndpoint(services, {
    id: 'atproto_pds', type: 'AtprotoPersonalDataServer',
  })
  if (!pds) throw createError(404, 'Origin not found')
```

Its public CDN URL shape is `/{preset}/plain/{did}/{cid}@{format}`
(`packages/bsky/src/image/uri.ts:42-44`) — DID and CID only. No host. Tangled does the same, calling
`idResolver.ResolveIdent(...)` then `ownerId.PDSEndpoint()` immediately before every blob fetch
(`appview/repo/artifact.go:175-184`).

**Read: nobody in this ecosystem stores a PDS host next to content. Two independent AppViews
resolve it per request from a DID-keyed identity cache.**

---

## 2. `@atcute/identity-resolver`: the real surface — serves #5 and #11

Confirmed: **there is no cache and no request coalescing.** Measured against a local probe server
(`bun run probe3.ts`, `PlcDidDocumentResolver` with an instrumented `fetch`):

```
  5 sequential resolve() calls => 5 upstream fetches
  5 CONCURRENT resolve() calls => 5 upstream fetches (request coalescing?)
  own enumerable props on resolver: ["apiUrl"]
```

### Interfaces — verbatim

The report that it is "one method" is accurate. All three resolver kinds are a single `resolve`:

```ts
// atcute/packages/identity/identity-resolver/lib/types.ts:4-35
export interface ResolveDidDocumentOptions { signal?: AbortSignal; noCache?: boolean; }
export interface DidDocumentResolver<TMethod extends string = string> {
	resolve(did: Did<TMethod>, options?: ResolveDidDocumentOptions): Promise<DidDocument>;
}
export interface ResolveHandleOptions { signal?: AbortSignal; noCache?: boolean; }
export interface HandleResolver {
	resolve(handle: Handle, options?: ResolveHandleOptions): Promise<AtprotoDid>;
}
export interface ResolveActorOptions { signal?: AbortSignal; noCache?: boolean; }
export interface ResolvedActor { did: Did; handle: Handle; pds: string; }
export interface ActorResolver {
	resolve(actor: ActorIdentifier, options?: ResolveActorOptions): Promise<ResolvedActor>;
}
```

Note `ResolvedActor` already carries `{ did, handle, pds }` — `LocalActorResolver` is the
one-call "give me everything about this actor" seam
(`identity-resolver/lib/actor/local.ts:27-76`), and it performs bidirectional handle verification,
falling back to the literal string `'handle.invalid'` when the handle does not round-trip.

Constructors, copied from source:

| Class | Constructor options | File |
| --- | --- | --- |
| `PlcDidDocumentResolver` | `{ apiUrl = 'https://plc.directory', fetch = fetch }` | `did/methods/plc.ts:18-24` |
| `WebDidDocumentResolver` | `{ fetch = fetch }` | `did/methods/web.ts:16` |
| `AtprotoWebDidDocumentResolver` | `{ fetch = fetch }` | `did/methods/web.ts:60` |
| `XrpcDidDocumentResolver` | `{ serviceUrl, fetch = fetch }` | `did/methods/xrpc.ts:31` |
| `CompositeDidDocumentResolver` | `{ methods: { [K]: DidDocumentResolver<K> } }` | `did/composite.ts:14` |
| `DohJsonHandleResolver` | `{ dohUrl, fetch = fetch }` | `handle/methods/doh-json.ts:20` |
| `WellKnownHandleResolver` | `{ fetch = fetch }` | `handle/methods/well-known.ts:17` |
| `XrpcHandleResolver` | `{ serviceUrl, fetch = fetch }` | `handle/methods/xrpc.ts:35` |
| `CompositeHandleResolver` | `{ methods: { http, dns }, strategy = 'race' }` | `handle/composite.ts:19` |
| `NodeDnsHandleResolver` | `{ nameservers? }` | `identity-resolver-node/lib/did/methods/node.ts:28` |

The `fetch` injection point is the whole cache story: **atcute has no cache because it expects you
to supply one by wrapping `fetch`.** That is precisely what frontpage does (§4).

### `did:plc` vs `did:web`

- `did:plc` → `GET {apiUrl}/{encodeURIComponent(did)}`, `redirect: 'manual'`, a 3xx is treated as an
  error (`plc.ts:35-46`).
- `did:web` → two classes. `WebDidDocumentResolver` uses `webDidToDocumentUrl(did)` and supports
  path-bearing DIDs. `AtprotoWebDidDocumentResolver` hard-rejects them:

```ts
// atcute/packages/identity/identity-resolver/lib/did/methods/web.ts:70-75
const [host, ...paths] = did.slice(8).split(':').map(decodeURIComponent);
const url = new URL(`https://${host}/.well-known/did.json`);
if (paths.length > 0) { throw new err.ImproperDidError(did); }
```

This matches atproto, which throws `UnsupportedDidWebPathError` for the same input
(`packages/identity/src/did/web-resolver.ts:26-31`). **Use `AtprotoWebDidDocumentResolver`, not
`WebDidDocumentResolver`** — the generic one will happily fetch `https://example.com/user/alice/did.json`,
which atproto considers not-a-thing.

### Failure modes — measured, not read

Each row is an actual `resolve()` call against a controlled server (`bun run probe3.ts`):

| Situation | Result |
| --- | --- |
| well-formed document | resolves |
| **document `id` ≠ requested DID** | **resolves — NOT checked** |
| document with no `service` array | resolves (empty doc; `getPdsEndpoint` returns `undefined` later) |
| two `#atproto_pds` service entries | `FailedDocumentResolutionError` ← `ValiError` (whole doc rejected) |
| upstream `404` | `DocumentNotFoundError` |
| upstream `500` | `FailedDocumentResolutionError` ← `FailedResponseError` |
| upstream `302` | `FailedDocumentResolutionError` ← `TypeError('unexpected redirect')` |
| `content-type: text/html` | `FailedDocumentResolutionError` ← `ImproperContentTypeError` |
| malformed JSON | `FailedDocumentResolutionError` ← `ImproperResponseError` |
| `did:web:...` passed to the plc resolver | `UnsupportedDidMethodError` |
| `did:key:...` through `CompositeDidDocumentResolver` | `UnsupportedDidMethodError` |
| `did:web:example.com:user:alice` via `AtprotoWebDidDocumentResolver` | `ImproperDidError` |
| doc with no `#atproto_pds`, via `LocalActorResolver` | `ActorResolutionError('missing pds endpoint')` |

**The `id` mismatch row is a security gap.** `@atproto/identity` checks it —
`if (val.id !== did) throw new PoorlyFormattedDidDocumentError(did, val)`
(`packages/identity/src/did/base-resolver.ts:22-24`) — and atcute does not. frontpage patches it by
hand:

```ts
// frontpage/apps/frontpage/lib/data/atproto/did.ts:77-88
export const getDidDoc = cache(async (did: DID, noCache = false): Promise<DidDocument> => {
    const doc = await didResolver.resolve(did, { noCache });
    invariant(doc.id === did, `DID document id mismatch: expected ${did}, got ${doc.id}`);
    return doc;
  },
);
```

We must do the same.

Handle-resolution errors are a separate hierarchy (`errors.ts:53-99`): `DidNotFoundError`,
`FailedHandleResolutionError`, `InvalidResolvedHandleError`, `AmbiguousHandleError`. Measured
behaviour: NXDOMAIN and `.well-known` 404 both become `DidNotFoundError`; a `_atproto` TXT record
that isn't a valid atproto DID becomes `InvalidResolvedHandleError`; **two** `did=` TXT records
become `AmbiguousHandleError`.

### `DohJsonHandleResolver` vs the `-node` variant

They are not two builds of the same thing. They are two different resolution mechanisms, and the
`-node` package exports exactly one class:

```ts
// atcute/packages/identity/identity-resolver-node/lib/index.ts
export * from './did/methods/node.ts';
```

(The file path says `did/methods/` but the class is a `HandleResolver`. Upstream misfiling; harmless.)

| | `DohJsonHandleResolver` | `NodeDnsHandleResolver` |
| --- | --- | --- |
| package | `@atcute/identity-resolver` | `@atcute/identity-resolver-node` |
| mechanism | HTTPS `GET {dohUrl}?name=_atproto.<handle>&type=TXT`, `accept: application/dns-json` | `node:dns/promises` `resolveTxt('_atproto.' + handle)` |
| requires | a DoH provider URL (no default) | a Node-compatible runtime; optional `nameservers` |
| runtime | anything with `fetch` (Workers, browser) | Node / Bun / Deno only |
| `options.noCache` | honoured → `cache: 'no-cache'` on the fetch (`doh-json.ts:35`) | **ignored — never read** |
| swappable `fetch` | yes (this is where you hang a cache) | **no** |
| not-found | DNS `Status: 3` (NXDOMAIN) → `DidNotFoundError` | `err.code === 'ENOTFOUND'` → `DidNotFoundError` |
| `options.signal` | passed into `fetch`, genuinely cancels | **checked only *after* the DNS query returns** (`node.ts:42-43`) |

That last row is a live trap for a Hono request with a deadline. Measured (`bun run probe5.ts`) —
already-aborted signal, nameserver pointed at a blackholed TEST-NET-3 address:

```
NodeDns  + pre-aborted signal + blackhole DNS -> DNSException after 25040ms
DohJson  + pre-aborted signal + blackhole DoH -> AbortError   after 3ms
```

**25 seconds versus 3 milliseconds.** `NodeDnsHandleResolver` cannot be timed out. If we want a
request-scoped deadline on handle resolution — and on Railway we do — use `DohJsonHandleResolver`,
which is also the one whose `fetch` we can wrap for caching. frontpage picked DoH
(`lib/data/atproto/identity.ts:14-26`) with `https://cloudflare-dns.com/dns-query`.

`CompositeHandleResolver` strategies, measured on a handle that resolves via DNS:
`race` 1 ms, `dns-first` 0 ms, `http-first` 784 ms, `both` 196 ms. `both` is the paranoid one — it
throws `AmbiguousHandleError` when DNS and HTTP disagree — and it is what frontpage uses.

---

## 3. Getting the PDS endpoint out of a DID document — serves #5

The target is a `service` entry with `id` `#atproto_pds` (or the absolute form
`<did>#atproto_pds`) and `type` `AtprotoPersonalDataServer`; the value is `serviceEndpoint`. Both
implementations agree on the happy path:

```ts
// atcute/packages/identity/identity/lib/utils.ts:133-138
export const getPdsEndpoint = (doc: t.DidDocument): string | undefined => {
	return getAtprotoServiceEndpoint(doc, {
		id: '#atproto_pds',
		type: 'AtprotoPersonalDataServer',
	});
};
```

```ts
// atproto/packages/common-web/src/did-doc.ts:66-71
export const getPdsEndpoint = (doc: DidDocument): string | undefined => {
  return getServiceEndpoint(doc, {
    id: '#atproto_pds',
    type: 'AtprotoPersonalDataServer',
  })
}
```

A real document, for shape reference (`curl https://plc.directory/did:plc:z72i7hdynmk6r22z27h6tvur`):

```json
"service": [ { "id": "#atproto_pds",
               "type": "AtprotoPersonalDataServer",
               "serviceEndpoint": "https://puffball.us-east.host.bsky.network" } ]
```

### Absent, duplicated, and malformed — measured

`bun run probe.ts`, `@atcute/identity@2.0.2`:

| document shape | `getPdsEndpoint` |
| --- | --- |
| relative `#atproto_pds` id | `https://a.example.com` |
| absolute `did:plc:…#atproto_pds` id | `https://a.example.com` |
| `type` is an array containing the right type | `https://a.example.com` |
| wrong `type` | `undefined` |
| no `service` key at all | `undefined` |
| empty `service` array | `undefined` |
| only a `#atproto_labeler` entry | `undefined` |
| **two `#atproto_pds` entries** | **the first one** |
| first entry has wrong `type`, second is correct | the second one |
| `serviceEndpoint` is an object | `undefined` |
| endpoint `https://a.example.com/pds` (has a path) | **`undefined`** |
| endpoint `https://a.example.com/?x=1` | `undefined` |
| endpoint `http://…` (not https) | `http://a.example.com` — accepted |

Absent ⇒ `undefined`, never a throw. Duplicated ⇒ first wins *at this layer* — but see the caveat
below, because the document usually never gets this far.

### Four divergences between atcute and atproto

Same inputs, both libraries (`bun run probe2.ts`):

```
case                                 | @atcute/identity             | @atproto/common-web
endpoint WITH A PATH                 | undefined                    | https://a.example.com/pds    <<< DIVERGES
endpoint with query                  | undefined                    | https://a.example.com/?x=1   <<< DIVERGES
first entry wrong type, 2nd right    | https://b.example.com        | undefined                    <<< DIVERGES
DUPLICATE #atproto_pds (a then b)    | https://a.example.com        | https://a.example.com
type as ARRAY containing PDS         | https://a.example.com        | undefined                    <<< DIVERGES
```

The mechanism: atcute scans the whole array and `continue`s past non-matching entries
(`utils.ts:106-130`), while atproto's `findItemById` returns the *first id match* and then bails if
the type is wrong (`did-doc.ts:93-100`). And atcute additionally demands the endpoint be a bare
origin:

```ts
// atcute/packages/identity/identity/lib/utils.ts:25-31
	return (
		url !== null &&
		(url.protocol === 'https:' || url.protocol === 'http:') &&
		url.pathname === '/' &&
		url.search === '' &&
		url.hash === ''
	);
```

**Practical consequence: a PDS hosted at a sub-path (`https://example.com/pds`) is invisible to
atcute and visible to atproto.** We are on atcute. Such an account's GIFs would show as "no PDS"
rather than as a broken image — an unresolvable-blob display state (#5 item 5), not a crash.

### The duplicate case usually never reaches `getPdsEndpoint`

atcute validates the whole document during resolution, and the schema rejects duplicate service ids
outright:

```ts
// atcute/packages/identity/identity/lib/typedefs.ts:91-99
	v.check((input) => {
		const services = input.service;
		if (!services?.length) { return true; }
		const did = input.id;
		const identifiers = services.map((s) => (s.id[0] === '#' ? did + s.id : s.id));
		return !hasDuplicates(identifiers);
	}, `duplicate service ids`),
```

Measured: a document with two `#atproto_pds` entries fails `PlcDidDocumentResolver.resolve()` with
`FailedDocumentResolutionError` ← `ValiError`. So in practice duplicates are a *resolution* failure,
not a first-wins pick. `did:plc` cannot produce them anyway — the PLC operation format stores
services as a keyed object (`services.atproto_pds`), so duplication is only reachable via a
hand-written `did:web`.

---

## 4. Cache invalidation reality — serves #5 and #11

### `plc.directory` sends an ETag and no `Cache-Control`

Measured 2026-08-26:

```console
$ curl -sSD - -o /dev/null https://plc.directory/did:plc:z72i7hdynmk6r22z27h6tvur
HTTP/2 200
content-type: application/did+ld+json; charset=utf-8
x-powered-by: Express
access-control-allow-origin: *
etag: W/"22a-UdJWjvZrrsNeBUQ5siC/Jy+nm2E"

$ curl -sSD - -o /dev/null -H 'If-None-Match: W/"22a-UdJWjvZrrsNeBUQ5siC/Jy+nm2E"' https://plc.directory/did:plc:z72i7hdynmk6r22z27h6tvur
HTTP/2 304
etag: W/"22a-UdJWjvZrrsNeBUQ5siC/Jy+nm2E"
```

So: **no `Cache-Control`, no `Expires`, no `Last-Modified` — but a working weak ETag and real 304s.**
It is Express's default `etag`, i.e. an unintentional freebie rather than a documented contract.
`plc.directory` tells us nothing about how long to cache; the TTL is entirely our policy call.
Revalidation is cheap (a 304 with no body), which makes ETag-conditional refresh a real option for
a background sweeper if we ever want one.

### What the official implementations default to, and why

`@atproto/identity` ships `MemoryCache` with a two-tier TTL:

```ts
// atproto/packages/identity/src/did/memory-cache.ts:12-15
  constructor(staleTTL?: number, maxTTL?: number) {
    this.staleTTL = staleTTL ?? HOUR
    this.maxTTL = maxTTL ?? DAY
  }
```

`staleTTL = 1 hour`, `maxTTL = 24 hours`. The two tiers are the point: between them the cached doc
is served *and* refreshed in the background; past `maxTTL` the read blocks on a fresh fetch:

```ts
// atproto/packages/identity/src/did/base-resolver.ts:46-55
    if (this.cache && !forceRefresh) {
      fromCache = await this.cache.checkCache(did)
      if (fromCache && !fromCache.expired) {
        if (fromCache?.stale) {
          await this.refreshCache(did, fromCache)
        }
        return fromCache.doc
      }
    }
```

The same 1h/24h pair is the PDS and Ozone default (`packages/pds/src/config/config.ts:119-120`,
`packages/ozone/src/config/config.ts:68-69`).

**Why 24 hours specifically** is stated in the migration guide, and it is a *correctness* bound, not
a freshness preference: "In some cases, if services have aggressive identity caching and do not
refresh on signature failure, service auth requests could fail for up to 24 hours." 24h is the
ecosystem's agreed worst-case blast radius for a stale identity. The guide also names the escape
hatch: services "should refresh their cache when they encounter errors (such as invalid service auth
signatures)."

Go-side, indigo's `DefaultDirectory()` uses `NewCacheDirectory(&base, 250_000, time.Hour*24,
time.Minute*2, time.Minute*5)` — capacity 250k, **hit TTL 24 h, error TTL 2 min, invalid-handle TTL
5 min**. Tangled uses that verbatim (`idresolver/resolver.go:51`) and 24 h / 30 s / 5 min for its
Redis variant (`resolver.go:59-62`). Two lessons we should copy: **negative results get a much
shorter TTL than positive ones**, and the cache does single-flight coalescing
(`didLookupChans`/`handleLookupChans` in indigo's `cache_directory.go`) which atcute does not.

frontpage, which is on our exact stack (atcute + a server framework), caches by wrapping `fetch`:

```ts
// frontpage/apps/frontpage/lib/data/atproto/did.ts:40-50
    plc: new PlcDidDocumentResolver({
      apiUrl: serverConfig.PLC_DIRECTORY_URL ?? "https://plc.directory",
      fetch: (request) =>
        fetch(request, {
          headers: { "User-Agent": FRONTPAGE_APPVIEW_USER_AGENT },
          next: {
            // TODO: Also revalidate this when we receive an identity change event
            // That would allow us to extend the revalidation time to 1 day
            revalidate: 60 * 60, // 1 hour
          },
        }),
    }),
```

DID documents 1 h; handles (both DoH and well-known) 24 h
(`lib/data/atproto/identity.ts:22-24, 35-37`); plus `React.cache` for per-request memoisation. The
`TODO` is the interesting part — **frontpage says 1 hour is a workaround, and event-driven
invalidation is what would let them go to 24 hours.** We have that event (tap's `IdentityEvent`),
which frontpage does not.

### How often do they actually change?

Measured against the PLC export stream, 2026-08-25T00:00:00Z → 01:31:52Z (91 minutes, walked with
`GET /export?count=1000&after=…`):

- **19 980 operations total; 19 890 creates, 110 updates (0.55 %).** The create rate is inflated by
  bulk signups, so read the absolute number instead: ~110 DID-document changes network-wide per 91
  minutes, ≈ **72 per hour**.
- Classifying all 110 in-window updates against their immediate predecessor in each DID's audit log:

  ```
  in-window update ops classified: 110
      110 handle  -  -  -
  ```

  **All 110 were handle-only changes. Zero PDS migrations happened network-wide in that window.**
- Widening to the *entire* history of those 106 distinct DIDs (800 consecutive-operation transitions):

  ```
      792 handle      -    -            -
        5 -           pds  signingKey   -
        2 -           pds  signingKey   rotationKeys
        1 -           -    -            -
  ```

Read that table carefully, because it has three usable findings:

1. **Handle changes outnumber PDS migrations ~113:1.** A handle→DID cache is the hot one.
2. **The PDS endpoint never moved without the signing key moving too — 7 out of 7.** So a stale
   *signing key* and a stale *PDS host* always go bad together. If we ever verify signatures, the
   "refresh on signature failure" rule the migration guide recommends doubles as PDS-staleness
   detection for free.
3. **PDS and handle never changed in the same operation** in this sample. Migrations are quiet;
   renames are loud.

**Takeaway for #5's item 2:** a DID-document cache with a 24 h TTL is safe *only* because the
`identity` event lets us invalidate early. Without the event, 1 h (frontpage's number) is the
defensible ceiling. With it, indigo's 24 h is.

---

## 5. Handle changes and stale-handle URLs — serves #11

### What tap gives us

tap always delivers identity events regardless of collection filters, and they carry more than the
firehose `#identity` does:

```ts
// atproto/packages/tap/src/types.ts:15-26, 58-68
export const identityEventDataSchema = l.object({
  did: l.string({ format: 'did' }),
  handle: l.string({ format: 'handle' }),
  is_active: l.boolean(),
  status: l.enum(['active','takendown','suspended','deactivated','deleted']),
})
export type IdentityEvent = {
  id: number; type: 'identity'
  did: DidString; handle: HandleString; isActive: boolean; status: RepoStatus
}
```

Compare the raw firehose event, which is deliberately thin — it is a *prod*, not a payload:

```json
// atproto/lexicons/com/atproto/sync/subscribeRepos.json, #identity
"description": "Represents a change to an account's identity. Could be an updated handle,
  signing key, or pds hosting endpoint. Serves as a prod to all downstream services to
  refresh their identity cache."
```

So the event tells us *that* something changed and gives us the new handle and status — it does
**not** tell us the new PDS endpoint. **On an `identity` event we must re-resolve the DID document
ourselves.** Bluesky's own indexer does exactly that, with `forceRefresh = true`:

```ts
// atproto/packages/bsky/src/data-plane/server/indexing/index.ts:136-137
    const atpData = await this.idResolver.did.resolveAtprotoData(did, true)
    const handleToDid = await this.idResolver.handle.resolve(atpData.handle)
```

### What must be invalidated

Three keys, and the second one is the one that gets forgotten:

1. `did → didDocument` (and everything derived: PDS endpoint, signing key).
2. **`oldHandle → did`.** The event carries only the *new* handle. indigo's `Purge` removes exactly
   one key per call and cannot infer the other:

   ```go
   // indigo/atproto/identity/cache_directory.go, Purge
   handle, err := atid.AsHandle()
   if nil == err { d.handleCache.Remove(handle); return nil }
   did, err := atid.AsDID()
   if nil == err { d.identityCache.Remove(did); return nil }
   ```

   To evict the old handle you must know it — which means reading your own stored handle for that
   DID *before* you overwrite it. If we promote `users` to the source of truth (#11 item 1), the
   old handle is right there in the row we are about to update.
3. `handle → did` for the *new* handle, if it was previously cached as pointing somewhere else.

Bluesky also handles the contention case explicitly — when a handle moves between accounts it
**nulls the loser's handle** rather than letting two rows claim it:

```ts
// atproto/packages/bsky/src/data-plane/server/indexing/index.ts:152-158
    if (handle && actorWithHandle && did !== actorWithHandle.did) {
      await this.db.db.updateTable('actor')
        .where('actor.did', '=', actorWithHandle.did)
        .set({ handle: null })
        .execute()
    }
```

A `UNIQUE` constraint on `users.handle` would deadlock on exactly this without that step.

### Handles get recycled. This is not hypothetical.

`bnewbold.bsky.social` was the original handle of `did:plc:44ybard66vv44zksje25o7dz` (PLC create
operation, 2022-12-18). Today:

```console
$ curl -sS "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=bnewbold.bsky.social"
{"did":"did:plc:i7twxqrvlztmllzlnuk4smgn"}
$ curl -sS "https://plc.directory/did:plc:i7twxqrvlztmllzlnuk4smgn" | jq -c '{id, alsoKnownAs}'
{"id":"did:plc:i7twxqrvlztmllzlnuk4smgn","alsoKnownAs":["at://bnewbold.bsky.social"]}
$ curl -sS "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=bnewbold.net"
{"did":"did:plc:44ybard66vv44zksje25o7dz"}
```

A **different DID** now holds that handle, and it claims it in `alsoKnownAs`, so it passes
bidirectional verification cleanly. **A stale handle→DID mapping does not degrade into an error; it
silently points at a stranger.** This is the argument for #11 item 1: the handle is a lease, the DID
is the identity, and any row keyed on a handle is a latent misattribution bug.

### Stale handle in a URL: 404 or redirect?

There is no protocol rule — `docs silent`. Practice diverges, and the divergence is coherent:

| Implementation | Behaviour (measured) |
| --- | --- |
| `bsky.app/profile/<stale handle>` | `200` — SPA shell; resolution happens client-side |
| `public.api.bsky.app` `app.bsky.actor.getProfile?actor=<stale handle>` | `400 AccountDeactivated` |
| frontpage `/profile/[user]` | `notFound()` → **404** |
| `tangled.org/@<stale handle>` | **`302`** to a canonical path |

frontpage resolves live on every request and 404s if the handle does not verify:

```tsx
// frontpage/apps/frontpage/app/(app)/profile/[user]/page.tsx:60-63
  const did = await getDidFromHandleOrDid(params.user);
  if (!did) {
    notFound();
  }
```

and its verification is strictly bidirectional — DID → doc → `alsoKnownAs` handle → resolve that
handle → must come back to the same DID, else `null` (`lib/data/atproto/identity.ts:44-64, 78-89`).
indigo does the same and surfaces `ErrHandleMismatch`, or the sentinel handle `handle.invalid` when
looking up by DID (`atproto/identity/directory.go` doc comment, `cache_directory.go`
`LookupHandleWithCacheState`). atcute's `LocalActorResolver` returns the same `'handle.invalid'`
string (`actor/local.ts:53`).

The honest reading: **404 is the safe default and the one our closest reference picked**, precisely
because of handle recycling — redirecting a recycled handle to the DID that *used* to own it sends
a visitor to the wrong person. A redirect is only correct when you can prove the requested handle
still belongs to the DID you are redirecting to, which is exactly the case where you did not need
to redirect. If we canonicalise URLs to DIDs (`/profile/did:plc:…`) the question mostly dissolves.

---

## 6. `com.atproto.sync.getBlob`: the contract, and the etiquette — serves #5

### Auth: not required

The lexicon is explicit — "Get a blob associated with a given account. Returns the full blob as
originally uploaded. **Does not require auth**; implemented by PDS."
(`atproto/lexicons/com/atproto/sync/getBlob.json:7`). The handler uses
`authorizationOrAdminTokenOptional` with `authorize: () => { /* always allow */ }`
(`packages/pds/src/api/com/atproto/sync/getBlob.ts:12-17`).

The exception is the migration case: a *deactivated* account's blobs require authentication as that
account on that PDS (guide, Blobs section; enforced by `assertRepoAvailability`). Declared errors:
`BlobNotFound`, `RepoNotFound`, `RepoTakendown`, `RepoSuspended`, `RepoDeactivated` — all delivered
as `400` with a JSON body.

### Response headers: measured, and they are hostile to hotlinking

```console
$ curl -sS -o /dev/null -D - "https://puffball.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=did:plc:z72i7hdynmk6r22z27h6tvur&cid=bafkrei…"
HTTP/2 200
cache-control: private
vary: Authorization
ratelimit-limit: 3000
ratelimit-policy: 3000;w=300
ratelimit-remaining: 2997
content-length: 256555
x-content-type-options: nosniff
content-disposition: attachment; filename="bafkrei…"
content-security-policy: default-src 'none'; sandbox
content-type: image/jpeg
```

- **`Cache-Control: private`** — set globally for authenticated-capable routes
  (`packages/pds/src/auth-verifier.ts:696`). No shared cache and no CDN may store this. There is no
  `max-age`, no `ETag`, no `Last-Modified`: nothing for a browser to revalidate against either.
  **Hotlinking a multi-MB GIF into a grid means re-downloading it from someone else's PDS on every
  render.** This is the single hardest number behind #5 item 3.
- **`Content-Disposition: attachment`** and **`CSP: default-src 'none'; sandbox`** — deliberate
  anti-embedding armour, added for XSS reasons (comments at `getBlob.ts:39-53`).
- No `Accept-Ranges`. Range requests are **ignored**, measured:

  ```console
  $ curl -sS -o /dev/null -D - -H 'Range: bytes=0-99' ".../getBlob?did=…&cid=…"
  HTTP/2 200
  content-length: 256555      # full body, not 206 Partial Content
  ```

  The handler streams the whole blob and sets `content-length` unconditionally
  (`getBlob.ts:37, 55-58`). No range support at any size.

### Rate limits: 3000 requests per 5 minutes, **per client IP**

The observed `ratelimit-policy: 3000;w=300` matches the reference PDS default exactly:

```ts
// atproto/packages/pds/src/rate-limits.ts:31-44
    global: [
      { name: 'global-ip',
        durationMs: 5 * MINUTE,
        points: 3000,
        calcKey: ({ req }) => {
          if (req.path === SYNC_GET_REPO_PATH) { return null }
          return req.ip
        },
      },
    ],
```

`getBlob` has no per-endpoint override, so it draws on this shared bucket. **Keyed by IP** —
meaning our whole AppView, behind one Railway egress IP, gets ~**10 requests/second against any one
PDS**, shared across all our users. A single popular self-hosted author could put us in
`429` territory. `getRepo` was deliberately carved out with its own 6000/5min budget
(`packages/pds/src/api/com/atproto/sync/getRepo.ts:28-31`); `getBlob` was not.

There is a negotiated escape hatch: `x-ratelimit-bypass` matching the PDS's
`PDS_RATE_LIMIT_BYPASS_KEY` (`rate-limits.ts:21-30`; the migration guide names the same env var).
Bluesky's AppView sends it, but only to hostnames it has an arrangement with
(`packages/bsky/src/api/blob-resolver.ts:295-317`). It is a per-operator agreement, not something we
can just set.

Note that a self-hosted PDS may have none of this: `pds.robocracy.org` returned no `ratelimit-*`
headers at all. Rate limiting is per-operator policy, not protocol.

### Etiquette: this is settled, and it is not "hotlinking is fine"

It is not merely accepted practice for an AppView to proxy blobs — **the spec effectively requires
it.** From <https://atproto.com/specs/blob>:

> Blobs are authoritatively stored by the account's PDS instance, but views are commonly served by
> CDNs associated with individual applications ("AppViews"), **to reduce traffic on the PDS**. CDNs
> may serve transformed (resized, transcoded, etc) versions of the original blob.

> It is **not a recommended or required pattern to serve media directly from the PDS to end-user
> browsers**, and servers do not need to support or facilitate this use case.

> It is effectively not supported to dynamically serve assets directly out of blob storage (the
> `getBlob` endpoint) directly to browsers and web applications. **Applications must proxy blobs,
> files, and assets through an independent CDN, proxy, or other web service before serving to
> browsers and web agents**, and such services are expected to implement security precautions.

Every reference implementation the project chose does this:

| Project | Proxy | Evidence |
| --- | --- | --- |
| Bluesky | `cdn.bsky.app` (BunnyCDN) + an in-AppView `/blob/:did/:cid` route | `packages/bsky/src/api/blob-resolver.ts`, `packages/bsky/src/image/uri.ts` |
| tangled | `camo` — HMAC-signed Cloudflare Worker image proxy; plus an `avatar` worker | `camo/readme.md`, `camo/src/index.js` |
| tangled (markdown) | still direct, and flagged as a known wart | `appview/pages/markup/markdown.go:314` — `// TODO: avoid directly fetching from PDS. use services like porxie instead.` |

The bandwidth difference is measurable. Same avatar, origin vs Bluesky's CDN:

```console
$ curl ... puffball.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob   → 256555 bytes, cache-control: private
$ curl ... cdn.bsky.app/img/avatar/plain/<did>/<cid>@jpeg                     →  25152 bytes, cache-control: max-age=604800, public
                                                                                 content-disposition: inline
                                                                                 cdn-cache: HIT
```

**10× smaller and cached publicly for 7 days, versus full-size and uncacheable.** Every grid render
we serve by hotlinking is that difference, paid by a stranger.

Two obligations that come with proxying, both visible in the reference:

1. **Verify the CID of what you stream.** `blob-resolver.ts` pipes the upstream body through
   `createCidVerifier(cid, encoding)` and 404s on mismatch (`:60-62, :141-144`). Content addressing
   is the only integrity we have once we stop being the origin.
2. **Respect hosting status on cached copies too.** The account spec is explicit that when status is
   non-`active`, what must stop being redistributed includes "blobs" *and* "transformed blobs
   (thumbnails, etc)" (<https://atproto.com/specs/account>, Hosting Status). A cache is a
   redistribution channel; a takedown must reach it.

And send a `User-Agent`. Bluesky sends `BSKY_USER_AGENT` (`blob-resolver.ts:304`); frontpage sends
`FRONTPAGE_APPVIEW_USER_AGENT` on every identity fetch. It is how a PDS operator tells us apart from
an abuser — see [atproto#4573](https://github.com/bluesky-social/atproto/issues/4573), where the
Bluesky AppView hammered a self-hosted PDS with ~90 `getBlob` requests every 5 minutes on a 500.

---

## What this decides / does not decide

### Decides for [#5](https://github.com/huketo/jjalcloud/issues/5)

- **Item 1 (where to resolve the PDS).** Settled: not on the `gifs` row. Migration deactivates the
  old PDS and it returns `400 RepoDeactivated` forever after; a per-row host is a permanent break,
  not a stale-but-working value. Resolve from a **DID-keyed** cache, which both reference AppViews
  do. The `gifs` row already carries DID (in the at-uri) and CID, and both survive migration
  unchanged — that is the whole durable key.
- **Item 2 (cache location and TTL).** Bounded, not chosen: 1 hour is the defensible TTL *without*
  event-driven invalidation (frontpage's number, and frontpage's own `TODO` says the event is what
  would buy 24 h). 24 hours is defensible *with* it, and we have tap's `identity` event, so the
  24 h/1 h stale-vs-max two-tier from `@atproto/identity` is directly portable to a Postgres table.
  Negative results need their own much shorter TTL (indigo: 2 min errors, 5 min invalid handles).
  Whether it is a Postgres table, an in-process LRU, or both is a human call.
- **Item 3 (image proxy).** Reframed. This is not a cost/benefit trade — the blob spec says
  applications **must** proxy rather than serve `getBlob` to browsers, and `Cache-Control: private`
  plus no ETag means hotlinking re-downloads the full multi-MB original on every single render. The
  remaining decision is *which* proxy (Railway egress at $0.05/GB vs a Cloudflare Worker like
  tangled's `camo`, which keeps the bytes off Railway entirely) — not *whether*.
- **Item 5 (missing-blob display).** Now enumerable: `400 RepoDeactivated` / `RepoTakendown` /
  `RepoSuspended` (account-level), `400 BlobNotFound` (blob-level), `undefined` from
  `getPdsEndpoint` (no PDS in doc, or a sub-path PDS that atcute refuses), and connection failure.
  Bluesky collapses upstream 4xx→404 and everything else→502 (`blob-resolver.ts:215-217`).

### Decides for [#11](https://github.com/huketo/jjalcloud/issues/11)

- **Item 1 (promote `users` to source of truth).** Strongly supported, and for a reason sharper than
  freshness: handles are recycled. `bnewbold.bsky.social` today resolves to a *different* DID that
  legitimately claims it. Any row keyed on a handle is a latent misattribution. Also note the
  `identity` event does **not** carry the PDS endpoint — receiving one obliges us to re-resolve the
  DID document ourselves (`forceRefresh`), which is what Bluesky's indexer does.
- **Item 5 (what happens on handle change / deactivation / takedown).** Mechanics settled: invalidate
  `did → doc`, `oldHandle → did` (requires reading the old handle before overwriting), and
  `newHandle → did`; null out any other row claiming the new handle, as Bluesky does, or a unique
  index will fight you. For stale-handle URLs, 404 is the safe convention and is what frontpage
  does; tangled 302s to a canonical path; there is no protocol rule — `docs silent`.
- **Bidirectional verification is mandatory and is not free.** Trusting `alsoKnownAs` alone is wrong
  (anyone can write any handle into their own DID document); trusting DNS alone is wrong. Both
  frontpage and indigo resolve in both directions and fall back to the sentinel `handle.invalid`.
  Budget for the second round trip.

### Hands to a human

1. **Cache substrate and shape.** Postgres table vs in-process LRU vs both. atcute has neither a
   cache *nor* request coalescing (measured: 5 concurrent `resolve()` calls → 5 upstream fetches),
   and indigo treats single-flight as essential. Serial ingest (ADR-0005/0006) makes the write side
   safe, but the read side is concurrent and will stampede.
2. **Proxy placement.** Railway (egress cost, simple) vs a Cloudflare Worker (keeps bytes off
   Railway, but reintroduces a Cloudflare dependency the project is deliberately shedding). Note the
   10× size reduction Bluesky gets is from *transcoding*, which the blob spec explicitly warns a PDS
   must not do but says CDNs may.
3. **Whether we ever verify repo signatures.** If we do, the "refresh identity on signature failure"
   convention gives us PDS-staleness detection for free — measured 7/7 PDS moves also rotated the
   signing key. If we do not, the `identity` event is our only invalidation signal and it must be
   reliable.
4. **Sub-path PDS hosts.** atcute silently refuses `https://example.com/pds` while atproto accepts
   it. Do we live with atcute's stricter rule (those users' GIFs render as "unavailable"), or patch
   around it?
5. **`x-ratelimit-bypass`.** Whether to seek arrangements with any large self-hosted PDS we end up
   pulling heavily from, or to rely on our own cache being good enough to stay under 10 req/s per
   PDS.

---

## Reproducing the measurements

Probe scripts live in `/tmp/identity-res/probe/` (throwaway; nothing was installed into this repo):

| script | what it shows |
| --- | --- |
| `probe.ts` | `getPdsEndpoint` / `getAtprotoHandle` shape matrix |
| `probe2.ts` | atcute vs `@atproto/common-web` divergences |
| `probe3.ts` | resolver failure modes; no cache, no coalescing |
| `probe4.ts` | DoH vs Node DNS vs well-known; composite strategies |
| `probe5.ts` | `NodeDnsHandleResolver` ignores `AbortSignal` (25 040 ms vs 3 ms) |
| `plcwalk.sh`, `classify2.sh` | PLC export walk and change classification |

PLC classification, condensed:

```console
$ sh plcwalk.sh
total ops: 19980
span: 2026-08-25T00:00:00.236Z .. 2026-08-25T01:31:52.727Z
  19890 create
    110 update
distinct updated DIDs: 106

$ sh classify2.sh
in-window update ops classified: 110
    110 handle	-	-	-
```
