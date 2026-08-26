# Does Bun's missing secp256k1 block the AT Protocol path?

## Verdict

**No.** Bun's `node:crypto` genuinely cannot do secp256k1 — verified, it throws
`ERR_OSSL_UNKNOWN_GROUP` — but no package in this repo's AT Protocol dependency surface routes k256
through `node:crypto` on Bun: `@atproto/crypto` is pure-JS `@noble/curves` on every runtime, and
`@atcute/crypto` ships an explicit `"bun"` export condition that selects its pure-JS
`@noble/secp256k1` backend. Both libraries' full k256 `did:key` sign/verify round-trips were
executed under Bun 1.3.14 and passed. The gap is also unreachable from our own code, which performs
no signature verification at all and uses an ES256/P-256 OAuth keyset.

## The gap is real

Bun documents it:

> Bun's crypto is backed by BoringSSL, which lacks the `ed448`, `x448`, `rsa-pss`, `dsa` and `dh`
> key types, EC curves other than P-224/256/384/521 (**no `secp256k1`**), and the CCM, OCB, XTS and
> chacha20-poly1305 ciphers.
>
> — <https://bun.com/docs/runtime/nodejs-compat>, `node:crypto` section

Confirmed by execution. Script `/tmp/librarian-bunk256/01-node-crypto-gap.mjs`:

```js
import { generateKeyPairSync } from 'node:crypto';
try {
  const kp = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  console.log('node:crypto ec secp256k1 : OK', kp.publicKey.asymmetricKeyDetails);
} catch (e) { console.log('node:crypto ec secp256k1 : FAIL', e.code ?? '', e.message); }
try { generateKeyPairSync('ec', { namedCurve: 'prime256v1' }); console.log('node:crypto ec prime256v1: OK'); }
catch (e) { console.log('node:crypto ec prime256v1: FAIL', e.code ?? '', e.message); }
try { await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'secp256k1' }, true, ['sign','verify']);
      console.log('webcrypto ECDSA secp256k1: OK'); }
catch (e) { console.log('webcrypto ECDSA secp256k1: FAIL', e.name ?? '', e.message); }
try { await crypto.subtle.importKey('jwk', { kty:'EC', crv:'secp256k1',
        x:'ivHl4nOMyOOTgFVvxOxL9nAFxLLL0LSUYXfLtRRp5Ec', y:'kJFvJAmqoXFRZ2CqSJp7ROXVdKTiVLHFxGdRWRZAqHM' },
        { name:'ECDSA', namedCurve:'secp256k1' }, true, ['verify']);
      console.log('webcrypto jwk secp256k1  : OK'); }
catch (e) { console.log('webcrypto jwk secp256k1  : FAIL', e.name ?? '', e.message); }
```

Output:

```
### BUN 1.3.14
node:crypto ec secp256k1 : FAIL ERR_OSSL_UNKNOWN_GROUP error:0f00007b:elliptic curve routines:OPENSSL_internal:UNKNOWN_GROUP
node:crypto ec prime256v1: OK
webcrypto ECDSA secp256k1: FAIL NotSupportedError The algorithm is not supported
webcrypto jwk secp256k1  : FAIL DataError Data provided to an operation does not meet requirements
### NODE v24.18.0
node:crypto ec secp256k1 : OK { namedCurve: 'secp256k1' }
node:crypto ec prime256v1: OK
webcrypto ECDSA secp256k1: FAIL NotSupportedError Unrecognized namedCurve
webcrypto jwk secp256k1  : FAIL NotSupportedError Unrecognized namedCurve
```

Two things to read off this. First, the Bun/Node divergence is exactly and only in `node:crypto`.
Second, **WebCrypto never supported secp256k1 on either runtime** — so anything already written
against WebCrypto (which is everything that ran on Workers) was never using k256 through the
platform in the first place. That single fact is why most of the surface below is already safe.

## Per-package table

Versions are what `bun add` resolved on 2026-08-26 into `/tmp/librarian-bunk256` (current surface)
and `/tmp/librarian-bunk256-atcute` (the atcute OAuth surface the transition adds).

| package | crypto backend | k256 path? | reachable from our code? | evidence |
| --- | --- | --- | --- | --- |
| `@atproto/crypto` 0.4.5 / 0.5.4 | pure JS `@noble/curves` + `@noble/hashes` | **yes**, `secp256k1Plugin`, `Secp256k1Keypair`, `verifyDidSig` | **no** — never imported by this repo; only pulled in transitively by unused `@atproto/xrpc-server` and by `@atproto/tap → @atproto/lex → @atproto/lex-installer → @atproto/lex-resolver` (a codegen/CLI chain) | `node_modules/@atproto/crypto/dist/secp256k1/operations.js:37` `require("@noble/curves/secp256k1")`; `package.json` deps are `{"@noble/curves","@noble/hashes","uint8arrays"}` only — no `node:crypto` |
| `@atcute/crypto` 2.4.4 | **runtime-conditional**: `bun`/`default` → `@noble/secp256k1`; `node` → `node:crypto`; `deno` → feature-detect | **yes**, `Secp256k1PublicKey`, `parseDidKey`, `verifySig` | **not today**; only if the atcute OAuth migration (#7) pulls it in — and it is *not* a transitive dep of `@atcute/oauth-node-client` or `@atcute/oauth-browser-client` | `node_modules/@atcute/crypto/package.json` `imports["#keypairs/secp256k1"]` = `{ bun: "./dist/keypairs/secp256k1-web.js", deno: …-deno.js, node: …-node.js, default: …-web.js }` |
| `@atcute/oauth-crypto` 1.0.1 | WebCrypto (`crypto.subtle`) | **no** — `CURVE_BY_ALG` is `{ES256:'P-256',ES384:'P-384',ES512:'P-521'}`; DPoP JWK schema is `v.picklist(['P-256','P-384','P-521'])` | yes, if #7 lands | `dist/internal/crypto.js:12-16`, `dist/dpop/verify.js:10`, `dist/dpop/generate-key.js:5-14` (`PREFERRED_ALGORITHMS` has no `ES256K`) |
| `@atcute/oauth-keyset` 0.1.3, `@atcute/oauth-node-client` 2.0.1, `@atcute/oauth-browser-client` 5.0.0 | delegate to `@atcute/oauth-crypto` | no | yes, if #7 lands | no match for `secp256k1\|ES256K\|verifySig\|did:key` anywhere in their `dist/` |
| `@atcute/client` 4.2.2 (`apps/web/src/utils/helpers.ts:46`, `apps/indexer`) | none — HTTP fetch handler only | no | yes (in use) | exports are `Client ClientResponseError ClientValidationError CredentialManager buildFetchHandler isXRPCErrorPayload ok simpleFetchHandler`; no crypto dep |
| `@atcute/identity` 1.1.5 / 2.0.2 | none | no — `did:key` handling is a **regex**, not a parse | transitive via `@atcute/client` | `dist/methods/key.js:1` `const KEY_DID_RE = /^did:key:z[a-km-zA-HJ-NP-Z1-9]+$/` |
| `@atcute/identity-resolver` 2.0.1 | none | no | yes, if #7 lands | no match for `secp256k1\|ES256K\|verifySig` in `dist/` |
| `@atcute/lexicons` 1.3.1, `@atcute/atproto` 3.1.12 | none | no | yes (in use) | schema/type packages; deps are `@standard-schema/spec`, `esm-env`, `@atcute/uint8array`, `@atcute/util-text` |
| `@atcute/uint8array` 1.1.x | `node:crypto` `hash` + `timingSafeEqual` (SHA only) | no | transitive | `dist/index.bun.js:4` imports only `{ hash, timingSafeEqual }` — both BoringSSL-supported |
| `@atproto/jwk-jose` 0.1.11 + `jose` 5.10.0 (`apps/web/src/auth/client.ts:1`) | WebCrypto on Bun (`jose` exports `bun → ./dist/browser/index.js`), Node KeyObjects on Node | **jose supports ES256K only on its Node build** | yes — but our keyset is ES256 | `node_modules/jose/package.json` `exports["."] = { bun: "./dist/browser/index.js", deno: …, browser: …, worker: …, workerd: …, import: "./dist/node/esm/index.js", require: … }` |
| `atproto-oauth-client-cloudflare-workers` 0.2.2 | delegates: `createKey: (algs) => JoseKey.generate(algs)` | **ES256K appears only as a zod JWK shape and as a sort preference** — `compareAlgos` puts `ES256K` first | yes (in use) — see "the one reachable path" below | `lib/oauth-client.js:12`, `lib/oauth-client/runtime.js:14-15,78-82` |
| `@atproto/api` 0.18.21, `@atproto/common-web` 0.4.21, `@atproto/lexicon` 0.6.2, `@atproto/syntax` | none — no crypto deps at all | no | `common-web` (`TID`) and `lexicon` (`BlobRef`) are used; `@atproto/api` is declared but never imported | dep lists contain no `@noble/*`, no `@atproto/crypto` |
| `@atproto/xrpc-server` 0.10.10+ (declared in `packages/common/package.json`) | pulls `@atproto/crypto` for service-auth JWT verification | **yes**, transitively | **no** — never imported anywhere in `packages/common/src` | `bun why @atproto/crypto` → `@atproto/xrpc-server`; no `import … from "@atproto/xrpc-server"` in the repo |
| `@atproto/tap` 0.4.4 (+ `@atproto/common` 0.8.0, `@atproto/ws-client` 0.2.1, `@atproto/syntax`, `@atproto/lex`, `ws`) | **no signature verification whatsoever** | **no** | will be, after #2 | zero matches for `secp256k1\|ES256K\|verifySig\|did:key\|@atproto/crypto` in `@atproto/tap/dist`; the only `sign` hits are `AbortSignal`, and auth is a basic-auth admin password (`dist/util.js`). `@atproto/common`'s `node:crypto` use is `createHash` in `ipld.js:1` and `streams.js:1` — SHA-256, BoringSSL-fine |

## Executed proof under Bun

### `@atproto/crypto` — full k256 `did:key` round-trip

`/tmp/librarian-bunk256/02-atproto-crypto-k256.mjs`:

```js
import { Secp256k1Keypair, P256Keypair, verifySignature, parseDidKey, secp256k1Plugin } from '@atproto/crypto';
const data = new TextEncoder().encode('hello atproto');
const kp = await Secp256k1Keypair.create({ exportable: true });
const did = kp.did();
const sig = await kp.sign(data);
console.log('k256 did:key            :', did);
console.log('k256 parseDidKey jwtAlg :', parseDidKey(did).jwtAlg);
console.log('k256 verifySignature    :', await verifySignature(did, data, sig));
console.log('k256 plugin.verifySig   :', await secp256k1Plugin.verifySignature(did, data, sig));
console.log('k256 tamper -> false    :', await verifySignature(did, new TextEncoder().encode('x'), sig));
const p = await P256Keypair.create({ exportable: true });
console.log('p256 did:key            :', p.did());
console.log('p256 verifySignature    :', await verifySignature(p.did(), data, await p.sign(data)));
```

`bun run 02-atproto-crypto-k256.mjs`:

```
k256 did:key            : did:key:zQ3shfChs1jiDd4kgVpmDrhyGU6pmMQTaCWUGgPX9nJwWHQgq
k256 parseDidKey jwtAlg : ES256K
k256 verifySignature    : true
k256 plugin.verifySig   : true
k256 tamper -> false    : false
p256 did:key            : did:key:zDnaeuPHdCQQcPxzgXq1dmqWL3KLn8rSDN9c2hv84iBErtzwZ
p256 verifySignature    : true
```

Identical output under `node` (only the random keys differ). `@atproto/crypto` has no runtime
branch — it is `@noble/curves` everywhere, so Bun and Node take the same code.

### `@atcute/crypto` — the runtime-conditional one, and the proof the `bun` condition fires

This is the only package where the answer could have gone the other way. `/tmp/librarian-bunk256-atcute/03-atcute-crypto-k256.mjs`
prints the *constructor name*, which differs between the two backends:

```js
import { Secp256k1PrivateKeyExportable, Secp256k1PublicKey, P256PrivateKeyExportable, parseDidKey, verifySig } from '@atcute/crypto';
const data = new TextEncoder().encode('hello atproto');
console.log('Secp256k1PublicKey ctor :', Secp256k1PublicKey.name);
const kp = await Secp256k1PrivateKeyExportable.createKeypair();
const did = await kp.exportPublicKey('did');
const sig = await kp.sign(data);
const parsed = parseDidKey(did);
console.log('k256 did:key            :', did);
console.log('k256 parseDidKey        :', parsed.type, parsed.jwtAlg);
console.log('k256 verifySig          :', await verifySig(parsed, sig, data));
console.log('k256 tamper -> false    :', await verifySig(parsed, sig, new TextEncoder().encode('x')));
console.log('k256 export jwk crv     :', (await kp.exportPublicKey('jwk')).crv);
const p = await P256PrivateKeyExportable.createKeypair();
const pdid = await p.exportPublicKey('did');
console.log('p256 did:key            :', pdid);
console.log('p256 verifySig          :', await verifySig(parseDidKey(pdid), await p.sign(data), data));
```

```
### BUN
Secp256k1PublicKey ctor : Secp256k1PublicKey          <-- @noble/secp256k1 backend
k256 did:key            : did:key:zQ3shm6nmqnVvgacwhxkP8R8GyaVLPLdMeK2kAXzSavRAPfcF
k256 parseDidKey        : secp256k1 ES256K
k256 verifySig          : true
k256 tamper -> false    : false
k256 export jwk crv     : secp256k1
p256 did:key            : did:key:zDnaexo647Pcfr5DGXCzQWT5SBpz2zcHdLtxM2i7QkN2BywrH
p256 verifySig          : true

### NODE
Secp256k1PublicKey ctor : NodeSecp256k1PublicKey      <-- node:crypto backend
… all same results …
```

Bun picks `Secp256k1PublicKey` (from `dist/keypairs/secp256k1-web.js`, which imports
`{ Point, getPublicKey, signAsync, utils, verify } from '@noble/secp256k1'`); Node picks
`NodeSecp256k1PublicKey` (from `secp256k1-node.js`, which imports `createPrivateKey, createPublicKey,
generateKeyPair, sign, verify` from `node:crypto` and would have thrown on Bun). mary-ext has
already solved this for us, deliberately — the `bun` condition is listed *before* `node` in
`@atcute/crypto`'s `imports` map, and Bun honours the more specific condition.

### The bundler honours it too

Because the web app is bundled, the condition has to survive bundling, not just resolution.
`bun build entry.js --target=<t>` on `export { Secp256k1PublicKey } from '@atcute/crypto'`:

| target | inlined module | contains `node:crypto`? |
| --- | --- | --- |
| `bun` | `node_modules/@noble/secp256k1/index.js`, `class Secp256k1PublicKey` | no |
| `browser` | `node_modules/@noble/secp256k1/index.js`, `class Secp256k1PublicKey` | no |
| `node` | `@atcute/crypto/dist/keypairs/secp256k1-node.js`, `class NodeSecp256k1PublicKey` | **yes** |

### `@atproto/tap` and the atcute client import and run

`/tmp/librarian-bunk256/05-tap-atcute.mjs` under `bun`:

```
@atproto/tap exports     : LexIndexer SimpleIndexer Tap TapChannel assureAdminAuth formatAdminAuthHeader identityEventDataSchema identityEventSchema isCausedBySignal parseAdminAuthHeader parseTapEvent recordEventDataSchema recordEventSchema repoInfoSchema tapEventSchema
@atcute/client exports   : Client ClientResponseError ClientValidationError CredentialManager buildFetchHandler isXRPCErrorPayload ok simpleFetchHandler
@atcute/atproto exports  : ComAtprotoAdminDefs ComAtprotoAdminDeleteAccount … (schema modules)
@atproto/common-web keys : 64
@atproto/api AtpAgent    : function
@atproto/lexicon Lexicons: function
```

## Is a k256 path reachable from our code?

Two claims from the ticket, both checked against source rather than assumed.

**Claim 1 — the app performs no signature verification. Confirmed.** A repo-wide search of
`apps/`, `packages/` for `verifySignature|verifySig|did:key|secp256k1|k256|Secp256k1|@atproto/crypto|@atcute/crypto|verifyRepo|verifyCommit|verifyProofs|subtle|node:crypto|createVerify`
returns exactly one file: `apps/web/worker-configuration.d.ts`, a wrangler-generated type
declaration whose hits are `Crypto.subtle` doc comments. Zero hits in any `.ts`/`.tsx` under
`apps/web/src`, `apps/indexer/src`, `packages/common/src`.

The reason is structural, not accidental. The read path never sees a signature:

- `apps/indexer/src/jetstream.ts:8` consumes `wss://jetstream2.us-east.bsky.network/subscribe` —
  Jetstream emits already-decoded JSON records, not signed CAR blocks. There is no `commit.sig` to
  check.
- The write path goes through `@atcute/client`'s `Client` over the OAuth session's `fetchHandler`
  (`apps/web/src/utils/helpers.ts:43-48`), i.e. authenticated XRPC to the user's own PDS. Trust is
  TLS + DPoP, not repo-signature verification.
- `packages/common/src/lexicon/**` is pure lexicon codegen — `ValidationResult`, `BlobRef`, `CID`.

**Claim 2 — the OAuth keyset is ES256/P-256, not k256. Confirmed.** In
`apps/web/src/auth/client.ts`: `token_endpoint_auth_signing_alg: "ES256"` (line 85 and in
`createClientMetadata`), and `generatePrivateKey()` calls `JoseKey.generate(["ES256"])`.
`loadKeyset()` calls `JoseKey.fromJWK(jwk)` on the `PRIVATE_KEY_JWK` secret, which is whatever the
operator generated — an ES256 key, by construction of `generatePrivateKey()`.

Executed under Bun (`/tmp/librarian-bunk256/04-oauth-es256.mjs`, `06-jose-es256k.mjs`):

```
jose generateKeyPair ES256  : OK P-256
jose generateKeyPair ES256K : FAIL TypeError | Failed to generate key pair | None of the algorithms worked
JoseKey.createJwt ES256     : len= 150
```

So ES256 signing works; ES256K generation fails, as expected from the WebCrypto build. Under Node,
`jose generateKeyPair ES256K : OK secp256k1`.

### The one reachable path — and it degrades, it does not break

`atproto-oauth-client-cloudflare-workers` chooses the DPoP algorithm from the authorization
server's advertised list, and it *prefers* ES256K:

```js
// lib/oauth-client/runtime.js:13-16
async generateKey(algs) {
    const algsSorted = Array.from(algs).sort(compareAlgos);
    return this.implementation.createKey(algsSorted);
}
// lib/oauth-client/runtime.js:74-82
/** 256K > ES (256 > 384 > 512) > PS … */
function compareAlgos(a, b) {
    if (a === "ES256K") return -1;
    if (b === "ES256K") return 1;
    …
}
// lib/oauth-client.js:12
createKey: (algs) => JoseKey.generate(algs),
```

And Bluesky's AS really does advertise it:

```
$ curl -s https://bsky.social/.well-known/oauth-authorization-server | jq -c '{dpop_signing_alg_values_supported}'
{"dpop_signing_alg_values_supported":["RS256","RS384","RS512","PS256","PS384","PS512","ES256","ES256K","ES384","ES512"]}
```

So on every login, `JoseKey.generate(['ES256K', 'ES256', …])` is called with ES256K first.
`JoseKey.generateKeyPair` iterates and collects errors, returning the first algorithm that works
(`node_modules/@atproto/jwk-jose/dist/jose-key.js`, `generateKeyPair`). Executed
(`/tmp/librarian-bunk256/07-dpop-alg-fallback.mjs`):

```
### BUN
DPoP key chosen for ["ES256","ES256K"] -> crv = P-256 | alg = …,ES256
### NODE
DPoP key chosen for ["ES256","ES256K"] -> crv = secp256k1 | alg = …,ES256K
```

Bun falls back to ES256. **This is not a regression**: `jose`'s export map sends `workerd` to the
same `./dist/browser/index.js` that `bun` gets, so today's Workers deployment already fails ES256K
and already uses ES256 DPoP keys. Bun reproduces the current production behaviour exactly.

If the OAuth migration to atcute (#7) lands, this preference disappears entirely —
`@atcute/oauth-crypto`'s `generateDpopKey` filters the server list through `isSigningAlgorithm` and
ranks by a `PREFERRED_ALGORITHMS` array that has no ES256K in it. Executed under Bun with Bluesky's
real list:

```
atcute DPoP alg chosen  : ES256 | crv = P-256
atcute client assertion : ES256 | crv = P-256
atcute DPoP ES256K only : FAIL Error | no supported algorithms provided
```

## If a blocker did exist, the workaround is cheap

Recorded for the case where a future dependency does reach `node:crypto` k256:

1. **`@atcute/crypto` is already injectable at the seam** — `imports["#keypairs/secp256k1"]` in its
   `package.json`. A consumer can force the pure-JS backend with a Bun `--conditions` flag or by
   overriding the subpath import; no patching needed. It already resolves correctly on Bun, so this
   is a fallback, not a step.
2. **`@noble/curves` / `@noble/secp256k1` is a genuine drop-in** — it is what `@atproto/crypto`
   already uses on Node and what `@atcute/crypto` already uses on Bun, and both pass the same
   sign/verify/tamper assertions above. Correctness is not in question; the trade is native-vs-JS
   throughput, which for occasional `did:key` verification is irrelevant.
3. **A patch would be a last resort**, and would only be needed for a package that hard-imports
   `node:crypto` with `namedCurve: 'secp256k1'` and offers no condition — none exists in this tree.

## Caveats

- `JoseKey.verifyJwt()` throws under Bun: `CryptoKey instances for asymmetric algorithm verifying
  must be of type "public"` (jose's `check_key_type.js:58`), because `verifyJwt` resolves the key
  via the same `getKeyObj()` that returns the *private* CryptoKey. This is a WebCrypto-vs-Node
  behaviour difference in `jose`, **not** a secp256k1 issue, and workerd takes the identical browser
  build — so it fails on Workers today too. It is unreachable from this app, which never verifies a
  JWT with its own keyset. Flagged only so it is not mistaken for a Bun regression later.
- Bundling matters. The `bun` condition protects the *runtime*, but a bundler configured with
  `target: 'node'` (or a Vite SSR build resolving the `node` condition) would inline
  `secp256k1-node.js` and break at runtime under Bun. If `@atcute/crypto` ever enters the tree,
  whatever bundles the server must resolve with the `bun` condition. `bun build --target=bun` does;
  verified above.
- `@atproto/xrpc-server` is declared in `packages/common/package.json` but never imported. It is the
  only thing dragging `@atproto/crypto` into the current install. Removing it would shrink the
  surface, but that is a separate cleanup, not a Bun prerequisite.
- Versions resolved on 2026-08-26 differ from the manifests' floors (e.g. `@atproto/api` resolved
  0.18.21 for `^0.18.17`, `@atcute/lexicons` 1.3.1 for `^1.2.6`). Findings are about crypto
  backends, which have been stable across these ranges, but a lockfile bump is worth a re-check if
  a major moves.
- `@atcute/oauth-node-client` 2.0.1 requires `@atcute/client` ^5.1.1 and `@atcute/lexicons` ^2.0.2,
  while `apps/web` is on `@atcute/client` ^4.2.1 / `@atcute/lexicons` ^1.2.6. That is a #7 concern,
  not a crypto one, but it surfaced here and someone will trip on it.

## What this decides / does not decide

**Unblocks:**

- **#8 (this ticket)** — closed: secp256k1 does not block the Bun switch.
- **ADR 0002** (`docs/adr/0002-bun-as-runtime-with-owned-dockerfiles.md`) — its stated open risk,
  *"One open risk gates this decision: Bun's `node:crypto` has no `secp256k1` … Whether any
  dependency here reaches that code path is being verified before the switch"*, is now resolved
  negative. The ADR's gate can be lifted.
- **#2 (ingest seam / tap adapter)** — `@atproto/tap` does zero signature verification and imports
  cleanly under Bun; no crypto constraint on the adapter design.
- **#7 (atcute server-side confidential OAuth)** — removes secp256k1 as an objection. atcute's OAuth
  packages are WebCrypto/P-256 only, and its `@atcute/crypto` has a first-class Bun path. #7 is now
  decided purely on API shape and the `@atcute/client` v4→v5 major, not on runtime crypto.
- **#13 (CI/CD + Railway IaC)** — the Bun base image needs no native secp256k1 addon, no patch step,
  no `trustedDependencies` entry for a crypto package.

**Does not decide:**

- **#10 (XRPC surface scope)** — if that ticket adds server-side *service auth* (verifying
  inter-service JWTs signed by a PDS's k256 signing key), the k256 path becomes reachable for the
  first time. The answer stays "not blocked" — `@atproto/crypto` is pure JS and passes under Bun —
  but the reachability line in the table above would move from "no" to "yes", and this document's
  claim 1 would need restating.
- **#11 (profile source of truth)** and **#5 (blob resolution)** — if either introduces
  `com.atproto.sync.getRecord` + MST proof verification instead of trusting the PDS response, the
  same note applies.
- **#9 (Bun webview vs Playwright)** — unrelated; nothing here constrains it.
- Whether to keep `@atproto/xrpc-server` and `@atproto/api` as declared-but-unused dependencies.
