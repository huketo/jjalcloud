# Server-side confidential OAuth with atcute

## Verdict

Yes. `@atcute/oauth-node-client@2.0.1` is a first-class server-side AT Protocol OAuth client that
covers every capability the current `atproto-oauth-client-cloudflare-workers` wrapper gives us —
`private_key_jwt`/ES256 with a persisted keyset, `dpop_bound_access_tokens`, `authorize` /
`callback` / `restore` / `revoke`, DPoP nonce retry, token refresh — and it ships a Hono-on-Bun
example as its own reference app. Two things are genuinely ours to write: a DID/handle resolution
cache (atcute's resolvers are uncached), and the two Postgres-backed stores behind a 4-method
`Store<K, V>` interface. One real gap: `OAuthClient` exposes no `allowHttp`, so a **local
`http://` PDS** cannot be targeted — our loopback dev branch against `https://bsky.social` is
unaffected and was verified working.

Everything below was read from source at `mary-ext/atcute@f05b92f` (cloned 2026-08-26, HEAD commit
dated 2026-08-24) and from the published tarballs installed with Bun 1.3.14, plus live runs against
`bsky.social`.

---

## 1. atcute's OAuth packages and their scope

| Package | Version (npm) | Covers |
| --- | --- | --- |
| `@atcute/oauth-node-client` | 2.0.1 | **The server client.** `OAuthClient` (confidential + public), stores, session/token lifecycle, resolvers, PAR, refresh. |
| `@atcute/oauth-browser-client` | 5.0.0 | SPA-only. Not relevant here. |
| `@atcute/oauth-types` | 1.0.1 | valibot schemas for all OAuth metadata; `buildClientMetadata` / `buildPublicClientMetadata`; the `scope` builder namespace. |
| `@atcute/oauth-crypto` | 1.0.1 | WebCrypto ES256/RS/PS key gen, JWK handling, PKCE, DPoP proof signing, `createDpopFetch` (nonce dance). |
| `@atcute/oauth-keyset` | 0.1.3 | `Keyset` — key selection by `kid`/`alg`, `publicJwks`. |
| `@atcute/oauth-cab` | 0.1.1 | Client-assertion backend so a *browser* SPA can be confidential. Not needed for an SSR app. |

The package's own description is unambiguous about server use:

```json
"name": "@atcute/oauth-node-client",
"version": "2.0.1",
"description": "atproto OAuth client for Node.js and other server runtimes",
```
— `packages/oauth/node-client/package.json:2-4`

> atproto OAuth client for Node.js (plus Deno, Bun, and other server runtimes) and WebExtensions.
> supports both:
> - **confidential clients** - authenticate with `private_key_jwt`, longer session lifetimes (up to
>   180 days), requires key management and hosted metadata
> - **public clients** - no authentication (`token_endpoint_auth_method: 'none'`), shorter sessions
>   (2 weeks max), simpler setup for CLI tools and local development

— `packages/oauth/node-client/README.md:1-9`

---

## 2. Capability table

Paths are relative to the atcute repo root unless prefixed with `apps/web/` (this repo).

| Capability (current usage) | atcute provides? | Package / export | path:line | Our work if not |
| --- | --- | --- | --- | --- |
| `private_key_jwt` + ES256 confidential client (`client.ts:85-86`) | **Yes** | `@atcute/oauth-node-client` → `OAuthClient` w/ `keyset`; `negotiateClientAuth`, `createClientAssertionFactory` | `packages/oauth/node-client/lib/oauth-client.ts:57-73,174-178`; `lib/oauth-client-auth.ts:51-86,108-133` | — |
| Keyset loaded from a persisted `PRIVATE_KEY_JWK` secret (`client.ts:103-108`) | **Yes** | `keyset: ClientAssertionPrivateJwk[]` — raw JWKs, no import step; `generateClientAssertionKey` for provisioning | `lib/oauth-client.ts:61-62`; `packages/oauth/crypto/lib/client-assertion/generate-key.ts:15-26` | Read env var + `JSON.parse` + hard-fail (3 lines, same as today) |
| `dpop_bound_access_tokens: true` (`client.ts:70,88`) | **Yes, forced** | `buildClientMetadata` / `buildPublicClientMetadata` hardcode it | `packages/oauth/types/lib/build-client-metadata.ts:49,135,156` | — |
| Serving client metadata + JWKS (`routes/oauth.tsx:34-41`) | **Yes** | `oauth.metadata`, `oauth.jwks` (public keys only) | `lib/oauth-client.ts:159,248-250` | — |
| **DID cache** store | **No** | `@atcute/identity-resolver` exports only resolvers, no cache layer | `packages/identity/identity-resolver/lib/index.ts:1-14` | Wrap `DidDocumentResolver` (1 method) with a Postgres/LRU cache |
| **Handle cache** store | **No** | same | same | Wrap `HandleResolver` (1 method) |
| **OAuth state store** | **Yes (interface)** | `stores.states: StateStore = Store<string, StoredState>` | `lib/types/states.ts:27-28`; `lib/utils/store.ts:14-41` | Implement 4 async methods over Postgres |
| **Session store** | **Yes (interface)** | `stores.sessions: SessionStore = Store<Did, StoredSession>` | `lib/types/sessions.ts:19-20` | Implement 4 async methods over Postgres |
| `authorize(handle)` → handle→DID→PDS→AS resolution (`routes/oauth.tsx:59`) | **Yes** | `OAuthClient.authorize({ target: { type: 'account', identifier } })` → `OAuthResolver.resolveFromIdentity` | `lib/oauth-client.ts:268`; `lib/resolvers/index.ts:85-98` | Call-shape change: pass `{target}`, receive `{url, stateId}` not a bare `URL` |
| `callback(params)` (`routes/oauth.tsx:81`) | **Yes** | `OAuthClient.callback(URLSearchParams)` → `{ session, state }`; state deleted before use (replay guard), `iss` checked (RFC 9207), `sub` mismatch → revoke | `lib/oauth-client.ts:365-436` | — |
| `restore(did)` per request (`middleware/auth.ts:41`) | **Yes** | `OAuthClient.restore(did, { refresh })` → `OAuthSession` | `lib/oauth-client.ts:444-453` | — |
| `revoke(did)` (`routes/oauth.tsx:155`) | **Yes** | `OAuthClient.revoke(did)`; also `session.signOut()` | `lib/oauth-client.ts:461-472`; `lib/oauth-session.ts:99-106` | — |
| Loopback public client for dev (`client.ts:31-38,57-71`) | **Yes** | omit `keyset` → `buildPublicClientMetadata` builds `http://localhost?scope=…&redirect_uri=…` automatically | `packages/oauth/types/lib/build-client-metadata.ts:87-137` | Delete our hand-rolled `client_id` string builder |
| `allowHttp` for a local `http://` PDS/AS (`client.ts:51`) | **No (gap)** | resolvers accept `allowHttp`, `OAuthClient` never passes it | `lib/resolvers/protected-resource-metadata.ts:25,64-66` vs `lib/oauth-client.ts:214-223` | Not fixable from outside — the protocol check runs *before* the cache lookup. Only bites a local PDS; see §7 |
| XRPC over the session (`utils/helpers.ts:46`) | **Yes** | `OAuthSession implements FetchHandlerObject` → `new Client({ handler: session })` | `lib/oauth-session.ts:32`; `packages/clients/client/lib/fetch-handler.ts:5-7` | Drop the `createRpcClient` wrapper; pass `session` directly |

---

## 3. Store interfaces, verbatim

One interface serves every store. Sync or async both satisfy it (`Awaitable<T> = T | Promise<T>`),
so a Postgres implementation is a drop-in.

```ts
export interface GetOptions {
	/** abort signal for cancellation */
	signal?: AbortSignal;
}

export interface Store<K, V> {
	get(key: K, options?: GetOptions): Awaitable<V | undefined>;
	set(key: K, value: V): Awaitable<void>;
	delete(key: K): Awaitable<void>;
	clear(): Awaitable<void>;
}
```
— `packages/oauth/node-client/lib/utils/store.ts:4-41`

```ts
export interface OAuthClientStores {
	/** session store, keyed by DID */
	sessions: SessionStore;
	/** authorization state store, keyed by state ID (short-lived) */
	states: StateStore;
	/** DPoP nonce cache, keyed by origin (defaults to in-memory) */
	dpopNonces?: DpopNonceCache;
	/** AS metadata cache, keyed by issuer (defaults to in-memory) */
	asMetadata?: AuthorizationServerMetadataCache;
	/** protected resource metadata cache, keyed by origin (defaults to in-memory) */
	prMetadata?: ProtectedResourceMetadataCache;
}
```
— `lib/oauth-client.ts:43-55`

The five value types:

```ts
/** stored session data, keyed by DID. */
export interface StoredSession {
	dpopKey: DpopPrivateJwk;
	authMethod: ClientAuthMethod;
	tokenSet: TokenSet;
}
export type SessionStore = Store<Did, StoredSession>;
```
— `lib/types/sessions.ts:9-20`

```ts
/** stored authorization state, keyed by state ID (short-lived). */
export interface StoredState {
	dpopKey: DpopPrivateJwk;
	authMethod: ClientAuthMethod;
	pkceVerifier: string;
	issuer: string;
	redirectUri: string;
	sub?: Did;
	userState?: unknown;
	/** expiry unix timestamp (typically ~10 minutes) */
	expiresAt: number;
}
export type StateStore = Store<string, StoredState>;
```
— `lib/types/states.ts:7-28`

```ts
export interface TokenSet {
	iss: string; sub: Did; aud: string; scope: AtprotoOAuthScope;
	access_token: string; refresh_token?: string;
	token_type: 'DPoP';
	/** expiration time as unix timestamp (milliseconds) */
	expires_at?: number;
}
```
— `lib/types/token-set.ts:5-23`

```ts
/** nonce cache for DPoP fetch. */
export interface DpopNonceCache {
	get(key: string): Awaitable<string | undefined>;
	set(key: string, value: string): Awaitable<void>;
}
```
— `packages/oauth/crypto/lib/dpop/types.ts:12-15`

```ts
export type AuthorizationServerMetadataCache = Store<string, AtprotoAuthorizationServerMetadata>;
```
— `lib/resolvers/authorization-server-metadata.ts:16`

**Postgres-fit verdict: yes, both required stores are plain JSON.** `dpopKey` is a JWK object, not a
`CryptoKey` — no serialization adapter is needed (contrast `@atproto/oauth-client-node`, which needs
`toDpopKeyStore` to swap a `Key` instance for a JWK). Verified by round-tripping a real stored state
through `JSON.parse(JSON.stringify(…))`:

```
2g stored state keys: ["authMethod","dpopKey","expiresAt","issuer","pkceVerifier","redirectUri","sub","userState"]
2h stored state (redacted): {"authMethod":{"method":"none"},"issuer":"https://bsky.social",
    "redirectUri":"http://127.0.0.1:5173/oauth/callback","sub":"did:plc:z72i7hdynmk6r22z27h6tvur",
    "userState":{"returnTo":"/protected"},"expiresIn":599589,"dpopKeyAlg":"ES256","dpopKeyKty":"EC"}
2i JSON round-trippable (Postgres jsonb): "ES256"
```
(`bun run smoke.ts`, §6.)

Notes for the implementation:
- `states` needs TTL cleanup on our side; `StoredState.expiresAt` is written but atcute never sweeps.
  The README says states "should have ~10 minute TTL" (`README.md:156-158`); `authorize()` sets
  `expiresAt = Date.now() + 10 * 60 * 1000` (`lib/oauth-client.ts:322`).
- `clear()` is required by the type but atcute never calls it in the OAuth flow — a `DELETE FROM …`
  is fine.
- `requestLock?: LockFunction` — `<T>(name: string, fn: () => Promise<T>) => Promise<T>`
  (`lib/utils/lock.ts:1-2`). Without it, refresh is deduplicated only *within one process*
  (`CachedGetter` in-flight map). Railway running >1 replica means two replicas can race a
  single-use refresh token. A Postgres advisory lock (`pg_advisory_xact_lock`) satisfies this
  signature.

---

## 4. Token refresh and DPoP nonce retry: both inside the library

**Refresh — inside.** `restore()` → `SessionGetter.getSession(sub, 'auto')` → `CachedGetter.get`,
which refreshes when stale:

```ts
isStale(_sub, { tokenSet }) {
	if (tokenSet.expires_at == null) return false;
	// refresh if token expires within 10-40 seconds (randomized to reduce concurrent refreshes)
	const buffer = 10_000 + 30_000 * Math.random();
	return tokenSet.expires_at < Date.now() + buffer;
},
```
— `lib/session-getter.ts:114-121`

The refreshed set is written back through our store, and `invalid_grant` responses delete the
session and raise `TokenRefreshError` (`lib/session-getter.ts:98-110,133-140`). `addEventListener`
surfaces `updated`/`deleted` events (`lib/oauth-client.ts:253-261`).

There is a **second** refresh layer on the request path: `OAuthSession.handle()` retries once on a
`401 … error="invalid_token"`, forcing a refresh, and deletes the session if the retry still fails
(`lib/oauth-session.ts:117-162,171-185`).

**DPoP nonce — inside.** `createDpopFetch` stores the server's `DPoP-Nonce`, detects
`use_dpop_nonce` (400 JSON body for the AS, `WWW-Authenticate` for the PDS) and replays the request
once with the new nonce:

```ts
const shouldRetry = await isUseDpopNonceError(initResponse, isAuthServer);
if (!shouldRetry) return initResponse;
…
const nextProof = await sign(htm, htu, nextNonce, ath);
const nextRequest = new Request(input, init);
nextRequest.headers.set('DPoP', nextProof);
const retryResponse = await fetch(nextRequest);
```
— `packages/oauth/crypto/lib/dpop/fetch.ts:67-93`, used at `lib/oauth-server-agent.ts:86-92`
(AS side) and `lib/oauth-session.ts:51-57` (PDS side).

Caveat: the retry is skipped when the body is a `ReadableStream`, and on the PDS path also when the
caller passed a pre-built `Request` (`fetch.ts:72-74`). Blob uploads built from a stream will see
the un-retried response.

**Cost of `restore()` per request**, measured (§6): one HTTP call on a cold AS-metadata cache, zero
when warm. No identity resolution, no PDS call.

```
first restore(): 644ms, http calls=1 ["https://bsky.social/.well-known/oauth-authorization-server"]
second restore(): 1ms, http calls=0 []
```

The default `asMetadata` cache is in-memory with `ttl: 60e3, maxSize: 100`
(`lib/oauth-client.ts:198-204`), so on Railway each replica refetches AS metadata about once a
minute per issuer. Supplying `stores.asMetadata` backed by Postgres removes that.

---

## 5. Granular scopes — gates map ticket #16

atcute ships a **typed scope builder** covering the full atproto granular-permission grammar:

```ts
export * as scope from './scope.ts';
```
— `packages/oauth/types/lib/index.ts:4`, re-exported by `packages/oauth/node-client/lib/index.ts:13`

| Builder | path:line | Emits |
| --- | --- | --- |
| `scope.repo({ collection, action })` | `types/lib/scope.ts:37-50` | `repo?collection=app.bsky.feed.post&action=create&action=delete` |
| `scope.rpc({ lxm, aud })` | `:65-76` | `rpc?aud=*&lxm=com.atproto.repo.uploadBlob` |
| `scope.account({ attr, action })` | `:91-102` | `account?attr=email&action=manage` |
| `scope.blob({ accept })` | `:115-125` | `blob?accept=image/*` |
| `scope.identity({ attr })` | `:138-142` | `identity?attr=handle` |
| `scope.include({ nsid, aud })` | `:158-170` | `include?nsid=app.bsky.authFullApp&aud=did:web:api.bsky.app%23bsky_appview` |

Real output from a Bun run (§6, line `1d`):

```
atproto repo?collection=app.bsky.feed.post&action=create&action=delete rpc?aud=*&lxm=com.atproto.repo.uploadBlob blob?accept=image/* include?nsid=app.bsky.authFullApp&aud=did:web:api.bsky.app%23bsky_appview
```

The `repo:<nsid>` shape named in ticket #16 is the *older* spelling; atcute emits the current
query-parameter form (`repo?collection=<nsid>&action=…`) per the atproto oauth-scopes spec. Note the
deliberate encoding rule — `:` `/` `+` `,` `@` stay literal, `#` stays `%23` (`scope.ts:172-193`).

`transition:generic` still validates: the only constraint is that the space-separated scope string
contains `atproto`.

```ts
const isAtprotoOAuthScope = (input: string): boolean => {
	return isOAuthScope(input) && isSpaceSeparatedValue(ATPROTO_SCOPE_VALUE, input);
};
```
— `packages/oauth/types/lib/schemas/atproto-oauth-scope.ts:8-10`

`authorize({ scope })` may narrow but never widen beyond client metadata — `validateRequestedScope`
rejects duplicates and any scope not present in the metadata scope (`lib/oauth-client.ts:510-544`).

**So #16 is unblocked on the library side.** Migrating `transition:generic` → granular is a
metadata/scope-string change, not a library change. What atcute does *not* do is tell you which
grants a PDS actually honours; that stays an atproto-spec question.

---

## 6. Verification runs (Bun 1.3.14, x64 Linux, 2026-08-26)

Installed the published tarballs — `bun add @atcute/oauth-node-client @atcute/identity-resolver
@atcute/identity-resolver-node @atcute/lexicons @atcute/client` → **18 packages**, 1.85s, no
postinstall scripts.

Script `/tmp/librarian-atcute-smoke/smoke.ts` built a confidential client (ES256 key generated at
runtime), a loopback public client, then ran a **live** `authorize()` against `bsky.social`:

```
1a generated jwk: {"kty":"EC","crv":"P-256","alg":"ES256","kid":"main","hasD":true}
1b metadata: {
 "client_id": "https://jjalcloud.up.railway.app/oauth/client-metadata.json",
 "client_name": "jjalcloud",
 "redirect_uris": ["https://jjalcloud.up.railway.app/oauth/callback"],
 "scope": "atproto transition:generic",
 "application_type": "web",
 "subject_type": "public",
 "response_types": ["code"],
 "grant_types": ["authorization_code","refresh_token"],
 "token_endpoint_auth_method": "private_key_jwt",
 "token_endpoint_auth_signing_alg": "ES256",
 "dpop_bound_access_tokens": true,
 "jwks": { "keys": [{ "kty":"EC","crv":"P-256","x":"…","y":"…","kid":"main","alg":"ES256","use":"sig" }] }
}
1c jwks has d?: false
2a loopback client_id: http://localhost?scope=atproto+transition%3Ageneric&redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2Foauth%2Fcallback
2b loopback auth method: none | dpop: true | jwks: undefined
2c authorize() ok in 2499ms
2d authorization url: https://bsky.social/oauth/authorize?client_id=http%3A%2F%2Flocalhost%3Fscope%3D…
2f state store log: ["set g-m6j_fVq0ypF-d9IW8u3t9p"]
3 confidential PAR failed as expected (client_id not publicly hosted): OAuthResponseError |
  invalid_client_metadata | Unable to obtain client metadata for
  "https://jjalcloud.up.railway.app/oauth/client-metadata.json": Application not found
```

Reading of these results:
- `1b`/`1c` — the confidential metadata is exactly the shape `apps/web/src/auth/client.ts:73-90`
  hand-writes today, produced by the library, with private material stripped from `jwks`.
- `2c`/`2d` — a real handle (`bsky.app`) was resolved through DNS/well-known → `did:plc:…` → PDS →
  AS metadata, a PAR was pushed with a DPoP proof, and an authorization URL came back. The whole
  network path works on Bun.
- `2f` — the custom fully-async store (deliberately shaped like a Postgres one) was used; the state
  landed in it.
- `3` — the confidential PAR reached `bsky.social`'s PAR endpoint and was rejected only because the
  `client_id` URL is not hosted anywhere. That is the expected, correct failure and it proves the
  confidential request was formed and sent.

`restore.ts` seeded a fresh (non-stale) session and counted outbound requests through an injected
`fetch` — result quoted in §4.

`http.ts` confirmed the `allowHttp` gap:

```
http PDS -> OAuthResolverError | failed to resolve protected resource metadata: http://localhost:2583
            | cause: http resource not allowed (set allowHttp for development)
```

---

## 7. Bun compatibility

| Check | Result | Evidence |
| --- | --- | --- |
| Native addons | **None** in the 18-package tree | `find … -name '*.node' -o -name binding.gyp -o -name '*.wasm'` → empty |
| CJS files | **None** | `find … -name '*.cjs'` → empty |
| Module shape | Pure ESM, `"type": "module"`, single `"exports": { ".": "./dist/index.js" }`, `sideEffects: false`, `.d.ts` beside every `.js` | `node_modules/@atcute/oauth-node-client/package.json` |
| `engines` | **Absent** (no Node floor asserted) | same |
| `node:` builtins in shipped lib code | **Zero** across all `packages/oauth/*` — crypto is WebCrypto (`crypto.subtle`) | `packages/oauth/crypto/lib/internal/crypto.ts:35-81`; grep for `from 'node:` in `packages/oauth` hits only READMEs and examples |
| `node:` builtins in the wider set | **One**: `@atcute/identity-resolver-node` → `node:dns/promises` for DNS handle resolution | `packages/identity/identity-resolver-node/lib/did/methods/node.ts:1` |
| Runtime deps | `nanoid` (ESM, pure JS), `valibot` | `node_modules/@atcute/oauth-node-client/package.json` |
| Actually runs on Bun | **Yes** — live `authorize()` against `bsky.social`, §6 | `bun run smoke.ts` |

`@atcute/identity-resolver-node` is the only Node-coupled piece; Bun implements `node:dns/promises`
and it ran here (`2c`). If we would rather not depend on it, `DohJsonHandleResolver` from
`@atcute/identity-resolver` resolves handles over DNS-over-HTTPS with zero Node surface
(`packages/identity/identity-resolver/lib/handle/methods/doh-json.ts`) — that is what the
WebExtension section of the README uses (`README.md:393-425`).

Relevant to ADR 0002's open k256 risk: this OAuth path never touches secp256k1. ES256/P-256 only,
through `crypto.subtle` (`crypto/lib/internal/crypto.ts:15-25` maps `ES256 → P-256`).

**The library's own reference server is a Hono app run with Bun** — the same stack as our target:

```json
"scripts": { "dev": "bun run --hot src/index.ts" },
"dependencies": { …, "hono": "^4.13.2" },
"devDependencies": { "@types/bun": "latest" }
```
— `packages/oauth/node-client-example/package.json:5-20`

That example is a working transcription of every route we have: `/oauth/login` (`authorize`),
`/oauth/callback` (`callback`), `/protected` (`restore` + `new Client({ handler: session })` +
`com.atproto.server.getSession`), `/logout` (`revoke`), `/oauth-client-metadata.json`, `/jwks.json`
— `packages/oauth/node-client-example/src/index.ts:236-358`.

---

## 8. Maturity

| Signal | Value |
| --- | --- |
| npm release history (`@atcute/oauth-node-client`) | `0.1.0` 2025-12-13 → `0.1.3` 2025-12-22 → `1.0.0`/`1.1.0` 2026-01-30 → `1.1.1` 2026-05-08 → `2.0.0` 2026-05-09 → **`2.0.1` 2026-06-29** |
| Age | ~8.5 months old |
| Last release | 2026-06-29 (~2 months before this report) |
| Repo activity | HEAD commit 2026-08-24, two days before this report |
| Breaking changes so far | 2 majors in 8 months — `1.0.0` renamed key APIs; `2.0.0` was a dependency-driven bump (`@atcute/client@5`, `@atcute/lexicons@2`) with no own breaking change |
| Tests in the OAuth packages | ~1,550 lines of vitest across `oauth-server-agent`, both metadata resolvers, `memory-store`, `lru`, `dpop/fetch`, `scope`, `cab/backend` |
| Server-side use documented? | **Yes, explicitly** — README leads with confidential clients (`README.md:1-9`), documents custom stores (`:337-370`), and ships a runnable Hono/Bun example package |
| Canonical home | tangled.org (`did:plc:pljn5qch4tgadongtc7i6qij`); `github.com/mary-ext/atcute` is the mirror we read |

Version-relevant breaking-change note from `1.0.0` (`packages/oauth/node-client/CHANGELOG.md:63-80`):
`generatePrivateKey` → `generateClientAssertionKey`, `importPkcs8Key` → `importClientAssertionPkcs8`,
`PrivateKey` → `ClientAssertionPrivateJwk`; `importJwkKey`/`exportJwkKey` removed because JWKs are
now used directly. Any tutorial written before 2026-01-30 is stale.

Reading of the cadence: two majors in eight months is a young library that still moves. It is not
abandonware, and the direction of travel (granular scopes landed in `0.1.3`, public clients in
`1.1.0`) tracks the spec ahead of `@atproto/oauth-client-node`. **[INFERENCE]** Expect another
major inside a year; budget a version-bump review rather than treating this as frozen.

---

## 9. The fallback, costed — because we should know what we are not choosing

atcute **does** cover confidential server clients, so the hybrid is not required. Recording the
comparison anyway so the decision is on the record.

Read at `@atproto/oauth-client-node@0.5.3` (installed 2026-08-26).

| | `@atcute/oauth-node-client` 2.0.1 | `@atproto/oauth-client-node` 0.5.3 |
| --- | --- | --- |
| Install footprint | **18 packages** | **34 packages** (incl. `core-js`, `jose`, `zod`) |
| `engines` | none | **`"node": ">=22"`** |
| Native / lifecycle scripts | none | `core-js` postinstall — Bun blocks it by default (`bun pm untrusted`); harmless but noisy |
| `node:` builtins | none in lib code | `node:crypto` |
| Store interface | `get`/`set`/**`delete`**/`clear` | `SimpleStore`: `get`/`set`/**`del`**/`clear?` — `@atproto-labs/simple-store/dist/simple-store.d.ts:7-15` |
| DPoP key in the store | plain JWK — Postgres-ready as-is | `Key` instance; needs the `toDpopKeyStore` adapter to expose `dpopJwk` — `oauth-client-node/dist/node-dpop-store.d.ts:13-20` |
| DID / handle cache | **not provided** | **provided** — `DidCache`, `HandleCache` in `OAuthClientOptions` — `oauth-client/dist/oauth-client.d.ts:3,5,18` |
| `allowHttp` | **absent** | **present** — `oauth-client/dist/oauth-client.d.ts:38` |
| Granular scope builders | **`scope.repo/rpc/account/blob/identity/include`** | **none** — only `isAtprotoOAuthScope`, a "contains `atproto`" check — `oauth-types/dist/atproto-oauth-scope.js:4-6` |
| `authorize` signature | `({target, scope, state, …}) => {url, stateId}` | `(input: string, opts?) => URL` — matches our current call |
| Session handler for `@atcute/client` | `implements FetchHandlerObject` — pass `session` directly | `fetchHandler(pathname, init)` — needs the `createRpcClient` wrapper we already have |
| Distinct advantage | scopes, Bun-native, small tree, JSON stores | identity caches, `allowHttp`, first-party |

**Shape A — atcute only (recommended).** One library. Our work: two Postgres `Store`
implementations, a cache wrapper around the two 1-method resolver interfaces, a Postgres advisory
lock for `requestLock`, and no local-`http` PDS in dev. Deletes `@atproto/jwk-jose` and the
third-party Workers wrapper outright.

**Shape B — hybrid, atcute for XRPC + `@atproto/oauth-client-node` for auth.** Buys the identity
caches and `allowHttp`; costs 34 packages, a Node ≥22 engine assertion under a Bun runtime, a
`core-js` postinstall Bun refuses to run, a `Key`↔JWK store adapter, and — the expensive part — no
scope builders, which is exactly what ticket #16 needs. It also forces two OAuth type universes
(zod + valibot) into one process.

**Shape C — atcute + our own confidential implementation.** Not on the table: §2 shows nothing
material is missing.

The two things Shape B buys are each a small amount of our own code under Shape A. The identity
cache is a wrapper over `resolve(did, options)` / `resolve(handle, options)`
(`packages/identity/identity-resolver/lib/types.ts:9-20`). `allowHttp` only matters if we intend to
run a local PDS — the current dev branch points a loopback *client* at real `bsky.social`, which
works today (§6, `2c`).

---

## What this decides / does not decide

**Decides**
- Ticket #7 itself: atcute covers server-side confidential OAuth. `@atcute/oauth-node-client@2.0.1`,
  `OAuthClient` with a `keyset`. No hybrid with `@atproto/oauth-client-node` is needed, and the
  `@atproto/jwk-jose` dependency in `apps/web/src/auth/client.ts:1` goes away with it.

**Unblocks**
- **#16 (granular scopes)** — the library side is ready today: `scope.repo/rpc/blob/account/identity/include`
  emit the current query-parameter grammar, and `transition:generic` keeps validating during the
  transition. What #16 still owes is the atproto-spec question of which grants a PDS honours, not a
  library question.
- Any ticket writing the Postgres schema: it needs exactly two tables — `oauth_state(state_id pk,
  data jsonb, expires_at)` with a sweeper, and `oauth_session(did pk, data jsonb)` — plus optional
  `did_doc` / `handle` cache tables and an `asMetadata` cache table.

**Reshapes**
- Whatever ticket rewrites `apps/web/src/auth/client.ts`: the call shapes change.
  `authorize(handle)` → `authorize({ target: { type: 'account', identifier: handle } })` returning
  `{url, stateId}`; the `didCache`/`handleCache` constructor options disappear and become resolver
  wrappers; `allowHttp` has no equivalent; the loopback `client_id` string we build by hand is now
  built by the library. `utils/helpers.ts:46` `createRpcClient` can be deleted — `new Client({
  handler: session })` works directly.
- Any ticket about running >1 Railway replica: it must supply `requestLock`, or two replicas will
  race a single-use refresh token. Not a concern on a single replica.

**Does not decide**
- Whether we run a local PDS in development. If we do, the missing `allowHttp` becomes a real
  blocker with no external workaround (the protocol check precedes the cache lookup) — it would
  need an upstream patch or a fork.
- Session-cookie strategy. atcute stores tokens; who is signed in is still our cookie, exactly as
  today.
- Blob-upload streaming behaviour: the DPoP nonce retry and the 401 retry are both skipped for
  `ReadableStream` bodies. Whether jjalcloud's uploads hit that path is a separate question.
