# How reference AppViews expose their XRPC surface

Research for [#19](https://github.com/huketo/jjalcloud/issues/19). Decision input for
[#10 — XRPC 표면의 범위](https://github.com/huketo/jjalcloud/issues/10). Facts only; no recommendation.

Sources read at these versions:

| Source | Version / commit |
| --- | --- |
| `bluesky-social/atproto` | `ea95a97` ("bsky: serve known likers on feed endpoints (#5444)") |
| `likeandscribe/frontpage` | `f23106d` ("Implement AT Tags community proposal meta tags (#376)") |
| `tangled.org/core` | `838c81a` ("nix/modules: register executors before starting spindle") |
| `@atproto/xrpc-server` | `0.12.5` (npm) |
| `@atproto/lex-cli` | `0.10.10` (npm) |
| `@atproto/lex` | `0.3.6` (npm) |
| `@atproto/lex-server` | `0.1.14` (npm) |
| `@atproto/lex-schema` | `0.2.5` (npm, transitively installed) |

---

## Verdict

**The `lex gen-server` output is hard-bound to Express and cannot sit on Hono** — the generated
`Server` merely wraps `@atproto/xrpc-server`'s `Server`, whose `router` field *is* an Express
application (`router: Express = express()`) and whose handlers are Express `RequestHandler`s taking
`(req, res, next)`. **But that is no longer the only official option**: the same monorepo now ships
`@atproto/lex-server`, whose `LexRouter` is a pure Fetch-API router
(`fetch: (request: Request) => Promise<Response>`) with **no Express dependency**, and whose own
JSDoc gives `Bun.serve({ fetch: router.fetch })` as a usage example. I mounted it inside Hono on Bun
with this repo's real `com.jjalcloud.feed.getSearch` lexicon and it served correct XRPC responses on
the first try (§3.3). So the choice is not "generated Server vs. hand-written Hono routes" — it is
**"legacy Express `xrpc-server`" vs. "Fetch-native `lex-server` `LexRouter`" vs. "hand-written"**,
and only the first is excluded by our stack.

Two caveats that a human must weigh, not me: `LexRouter` is at `0.1.x` and **no production service
inside the atproto monorepo uses it yet** (only tests and an example, §3.4), and it **does not
validate handler output at all** — an invalid response body is served with `200` (§4.6). Both
reference AppViews closest to us (`frontpage`, `tangled`) hand-write their XRPC routes on their own
framework's router and hand-write the error envelope; neither uses a generated server (§1, §2).

---

## 1. `frontpage` — does it serve its own NSIDs over `/xrpc/`?

**Yes, but only two of them, and both are feed-generator endpoints.** Its post/comment/vote data has
no XRPC surface at all.

The entire `/xrpc/` surface is two Next.js App Router route handlers:

```
$ find apps/frontpage/app/xrpc -type f
apps/frontpage/app/xrpc/fyi.frontpage.feed.describeFeedGenerator/route.ts
apps/frontpage/app/xrpc/fyi.frontpage.feed.getFeedSkeleton/route.ts
```

The directory name *is* the NSID — routing is by literal path segment, not by any registry.

App-internal data goes through a separate, non-XRPC `/api/*` tree:

```
$ find apps/frontpage/app/api -type f
apps/frontpage/app/api/hover-card-content/route.ts
apps/frontpage/app/api/notification-read/route.ts
apps/frontpage/app/api/fetch-link-og/route.ts
apps/frontpage/app/api/cron/rank-posts/route.ts
apps/frontpage/app/api/cron/oauth-cleanup/route.ts
apps/frontpage/app/api/notification-count/route.ts
apps/frontpage/app/api/receive_hook/route.ts
```

### How the lexicon is wired to the handler: it is not

The handler is hand-written and does not touch generated code. It parses `searchParams` by hand,
clamps `limit` by hand, and defines its own five-line error helper:

`frontpage/apps/frontpage/app/xrpc/fyi.frontpage.feed.getFeedSkeleton/route.ts:12-21`

```ts
function xrpcError(name: string, message: string, status: number) {
  return NextResponse.json({ error: name, message }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const feedParam = searchParams.get("feed");
  if (!feedParam) {
    return xrpcError("InvalidRequest", "Missing required parameter: feed", 400);
  }
```

`…:36-52`

```ts
  // Parse limit (default 50, clamp 1..100)
  let limit = DEFAULT_SKELETON_LIMIT;
  if (limitParam) {
    limit = Math.max(MIN_SKELETON_LIMIT, Math.min(MAX_SKELETON_LIMIT, parseInt(limitParam, 10) || DEFAULT_SKELETON_LIMIT));
  }
  const localFeed = parseLocalFeed(feed);
  if (!localFeed) {
    return xrpcError("UnknownFeed", "Feed not found", 404);
  }
```

Note that `UnknownFeed` — a lexicon-declared error name in
`frontpage/lexicons/fyi/frontpage/feed/getFeedSkeleton.json` (`"errors": [{ "name": "UnknownFeed" }]`)
— is returned with **404**, while the XRPC spec's guidance is that named lexicon errors are
"particularly encouraged on `400`, `500`, and `502` status codes". No output validation happens
anywhere in the handler.

### Where generated code *is* used: the client side

`frontpage/packages/frontpage-atproto-client/package.json:17`

```json
"build": "lex build --lexicons=../../lexicons --pure-annotations --clear && tsc"
```

That is `@atproto/lex` (`^0.0.24` in the pnpm catalog), which emits runtime schema objects — **not**
`lex gen-server`. Frontpage consumes them when it calls *other people's* feed generators over its own
NSID, and validates the response:

`frontpage/apps/frontpage/lib/data/feed-resolver.ts:115-118`

```ts
  const url = new URL(
    `/xrpc/${fyi.frontpage.feed.getFeedSkeleton.$nsid}`,
    serviceEndpoint,
  );
```

`frontpage/apps/frontpage/lib/data/feed-resolver.ts:143-145`

```ts
  try {
    fyi.frontpage.feed.getFeedSkeleton.$output.schema.assert(json);
  } catch (err) {
```

So frontpage validates *inbound* third-party responses against the lexicon, but not its own
*outbound* ones.

---

## 2. `tangled` — same questions

**Its AppView serves no `/xrpc/` at all.** Its `knot`, `knotmirror`, `spindle`, and `deliberi`
services do. All of them hand-write chi routes; none uses a generated server.

```
$ grep -rn '"/xrpc"' /tmp/lib-xrpc/tangled
deliberi/deliberi.go:85:      mux.Mount("/xrpc", x.Router())
knotmirror/knotmirror.go:82:  mux.Mount("/xrpc", xrpc.Router())
knotserver/router.go:113:     r.Mount("/xrpc", x.Router())
spindle/server.go:570:        mux.Mount("/xrpc", s.XrpcRouter())
```

`appview/state/router.go` mounts `/issues`, `/pulls`, `/settings`, `/.well-known/security.txt`, etc.
— no `/xrpc`.

### How the lexicon is wired to the handler: only the NSID constant

`tangled/knotserver/xrpc/xrpc.go:48-99` (abridged)

```go
func (x *Xrpc) Router() http.Handler {
	r := chi.NewRouter()

	r.Group(func(r chi.Router) {
		r.Use(x.ServiceAuth.VerifyServiceAuth)
		r.Post("/"+tangled.RepoSetDefaultBranchNSID, x.SetDefaultBranch)
		r.Post("/"+tangled.RepoCreateNSID, x.CreateRepo)
		…
	})

	// repo query endpoints (no auth required)
	r.Get("/"+tangled.RepoTreeNSID, x.RepoTree)
	r.Get("/"+tangled.RepoLogNSID, x.RepoLog)
	…
	return r
}
```

`tangled.RepoTreeNSID` is the *only* thing taken from codegen. `tangled/lexicon-build-config.json`
does set `"gen-server": true` for the `sh.tangled` and `org.tangled` prefixes, but the emitted Go
files contain no HTTP server — only structs, an NSID constant, and a *client* function:

`tangled/api/tangled/feedlistStars.go:13-14, 35-36`

```go
const (
	FeedListStarsNSID = "sh.tangled.feed.listStars"
)
…
func FeedListStars(ctx context.Context, c util.LexClient, cursor string, limit int64, order string, subject string) (*FeedListStars_Output, error) {
	var out FeedListStars_Output
```

Params are read straight off `r.URL.Query()` with no lexicon validation:

`tangled/knotserver/xrpc/repo_archive.go:13-28` (abridged)

```go
func (x *Xrpc) RepoArchive(w http.ResponseWriter, r *http.Request) {
	params, err := gitutil.ParseArchiveParams(r.URL.Query())
	if err != nil {
		writeError(w, xrpcerr.NewXrpcError(
			xrpcerr.WithTag("InvalidRequest"),
			xrpcerr.WithMessage(err.Error()),
		), http.StatusBadRequest)
		return
	}
	repo := r.URL.Query().Get("repo")
```

And the wire envelope is hand-rolled:

`tangled/xrpc/errors/errors.go:8-11`

```go
type XrpcError struct {
	Tag     string `json:"error"`
	Message string `json:"message"`
}
```

`tangled/knotserver/xrpc/xrpc.go:209-213`

```go
func writeError(w http.ResponseWriter, e xrpcerr.XrpcError, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(e)
}
```

### A finding worth flagging

Tangled *declares* a full AppView query surface in lexicon —
`sh.tangled.feed.listStars`, `feed.countStars`, `actor.getProfile`, `graph.listFollows`, and ~40
more — but **nothing in the repository serves them.** The generated NSID constants have zero
references outside their own definition file:

```
$ grep -rn 'FeedListStarsNSID|ActorGetProfileNSID|FeedCountStarsNSID' /tmp/lib-xrpc/tangled
api/tangled/actorgetProfile.go:14:  ActorGetProfileNSID = "sh.tangled.actor.getProfile"
api/tangled/feedcountStars.go:14:   FeedCountStarsNSID = "sh.tangled.feed.countStars"
api/tangled/feedlistStars.go:14:    FeedListStarsNSID = "sh.tangled.feed.listStars"
```

Publishing the lexicon and serving the endpoint are decoupled in practice.

---

## 3. `bluesky-social/atproto` — mounting `lex gen-server` output, and the Hono question

### 3.1 The generated `Server` is a thin wrapper over an Express app

`lex gen-server` still exists in `@atproto/lex-cli@0.10.10`
(`atproto/packages/lex-cli/src/index.ts`, `program.command('gen-server')`) and it generates imports
from `@atproto/xrpc-server`:

`atproto/packages/lex-cli/src/codegen/server.ts:56-66`

```ts
    //= import {createServer as createXrpcServer, Server as XrpcServer} from '@atproto/xrpc-server'
    file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc-server',
      namedImports: [
        …
        { name: 'Server', alias: 'XrpcServer' },
        …
      ],
    })
```

I ran it on this repo's actual lexicons:

```
$ cd /tmp/lib-xrpc/gen && ./node_modules/.bin/lex gen-server --yes ./out $(find lexicons -name '*.json' | sort)
[+ add] /tmp/lib-xrpc/gen/out/types/com/jjalcloud/feed/getSearch.ts
[+ add] /tmp/lib-xrpc/gen/out/lexicons.ts
[+ add] /tmp/lib-xrpc/gen/out/index.ts
API generated.
```

The generated `Server` holds an `XrpcServer` and nothing else — namespace objects delegate to
`this._server.xrpc.method(nsid, cfg)`:

`/tmp/lib-xrpc/gen/out/index.ts:19-28, 108-118` (generated from our lexicons)

```ts
export class Server {
  xrpc: XrpcServer
  app: AppNS
  com: ComNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    …
  }
}
…
  getSearch<A extends Auth = void>(cfg: MethodConfigOrHandler<…>) {
    const nsid = 'com.jjalcloud.feed.getSearch' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
```

### 3.2 `@atproto/xrpc-server` is Express, all the way down

`atproto/packages/xrpc-server/package.json:42` lists `"express": "^4.17.2"` as a hard runtime
dependency.

`atproto/packages/xrpc-server/src/server.ts:97-101, 139-141`

```ts
export class Server {
  router: Express = express()
  routes: Router = Router()
  subscriptions = new Map<string, XrpcStreamServer>()
  lex = new Lexicons()
…
  listen(port: number, callback?: () => void) {
    return this.router.listen(port, callback)
  }
```

Handlers are Express `RequestHandler`s and write through the Express response object —
`res.status(200)`, `res.header('Content-Type', …)`, `res.json(json)`, `pipeline(output.body, res)`
(a Node `Writable`), `next(err)`:

`atproto/packages/xrpc-server/src/server.ts:447-449, 490-507` (abridged)

```ts
  ): RequestHandler {
    return async function (req, res, next) {
      try {
        const params = paramsVerifier(req)
        …
        } else if (isHandlerSuccess(output)) {
          validateResOutput?.(output)
          res.status(200)
          setHeaders(res, output.headers)
          const encoding = output.encoding === 'json' ? 'application/json' : output.encoding
          res.header('Content-Type', encoding)
          …
          } else if (encoding === 'application/json') {
            const json = lexToJson(output.body)
            res.json(json)
```

A real AppView mounts it as Express middleware inside a bigger Express app:

`atproto/packages/bsky/src/index.ts:266-288`

```ts
    const server = createServer([], {
      validateResponse: config.debugMode,
      payload: { jsonLimit: 100 * 1024, textLimit: 100 * 1024, blobLimit: 5 * 1024 * 1024 },
    })

    API(server, ctx)

    app.use(health.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    …
    app.use(server.router)
    app.use(error.handler)
```

Per-endpoint registration looks like this:

`atproto/packages/bsky/src/api/app/bsky/feed/getLikes.ts:22-27`

```ts
export default function (server: Server, ctx: AppContext) {
  const getLikes = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.add(app.bsky.feed.getLikes, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
```

Verified empirically that the object is an Express app, not a fetch handler, under Bun:

```
$ bun run exp.ts   # createServer([]) from @atproto/xrpc-server
router typeof: function
has .listen: function
has express .use: function
is a fetch handler? .fetch = undefined
constructor: EventEmitter
```

There is no seam to attach it to Hono short of shimming `Request`/`Response` into Node
`IncomingMessage`/`ServerResponse`.

Worth noting: **bsky itself no longer uses `lex gen-server`.** Its codegen script is
`atproto/packages/bsky/package.json` → `"codegen:lex": "lex build --clear --indexFile --lexicons ../../lexicons"`,
i.e. `@atproto/lex` runtime schemas fed to `server.add(schema, config)`. `lex gen-server` is the
legacy path.

### 3.3 The Fetch-native alternative: `@atproto/lex-server`'s `LexRouter`

`atproto/packages/lex/lex-server/package.json` — dependencies are
`@atproto-labs/did-resolver`, `@atproto/crypto`, `@atproto/did`, `@atproto/lex-cbor`,
`@atproto/lex-client`, `@atproto/lex-data`, `@atproto/lex-json`, `@atproto/lex-schema`,
`http-terminator`, `tslib`, `ws`. **No express.**

`atproto/packages/lex/lex-server/src/lex-router.ts:129-133`

```ts
export type FetchHandler = (
  request: Request,
  connection?: ConnectionInfo,
) => Promise<Response>
```

`atproto/packages/lex/lex-server/src/lex-router.ts:567-569, 980-983`

```ts
export class LexRouter {
  /** Map of NSID strings to their fetch handlers. */
  readonly handlers: Map<NsidString, FetchHandler> = new Map()
…
  fetch: FetchHandler = async (
    request: Request,
    connection?: ConnectionInfo,
  ): Promise<Response> => {
```

The JSDoc above `fetch` names Bun explicitly:

`atproto/packages/lex/lex-server/src/lex-router.ts:963-979`

```
   * @example
   * ```typescript
   * // Use with Deno
   * Deno.serve(router.fetch)
   *
   * // Use with Bun
   * Bun.serve({ fetch: router.fetch })
   *
   * // Use with Node.js
   * import { toRequestListener } from '@atproto/lex-server/nodejs'
   * const listener = toRequestListener(router.fetch)
   * http.createServer(listener).listen(3000)
   * ```
```

#### Proof: it runs on Hono + Bun with this repo's own lexicon

`lex build` on `packages/common/lexicons/` produces a runtime schema module:

`/tmp/lib-xrpc/honotest/src/lexicons/com/jjalcloud/feed/getSearch.defs.ts` (generated)

```ts
export const $params = /*#__PURE__*/ l.params({
  q: l.optional(l.string({ maxLength: 1000 })),
  limit: l.optional(l.withDefault(l.integer({ minimum: 1, maximum: 100 }), 50)),
  cursor: l.optional(l.string({ maxLength: 10000 })),
})
…
/** Search for jjal by tags or titles. */
const main = /*#__PURE__*/ l.query($nsid, $params, $output)
```

Mounting the whole XRPC surface as a **single Hono route**:

`/tmp/lib-xrpc/honotest/server.ts` (written by me, run under `bun 1.3.14`)

```ts
import { Hono } from 'hono'
import { LexRouter } from '@atproto/lex-server'
import getSearch from './src/lexicons/com/jjalcloud/feed/getSearch.js'

const xrpc = new LexRouter()
xrpc.add(getSearch, async ({ params }) => ({ body: { gifs: [ /* … */ ] } }))

const app = new Hono()
app.get('/', (c) => c.text('hono is here'))
app.all('/xrpc/*', (c) => xrpc.fetch(c.req.raw))   // ← the whole seam

export default { port: 8791, fetch: app.fetch }
```

Real output:

```
--- root (hono own route)
hono is here
--- happy path
HTTP/1.1 200 OK
Content-Type: application/json;charset=utf-8
{"gifs":[{"uri":"at://did:plc:aaa/com.jjalcloud.feed.gif/cat", …, "value":{"limitSeen":50}, …}]}
--- unknown param + bad limit   (?q=cat&bogus=1&limit=500)
HTTP/1.1 400 Bad Request
{"error":"InvalidRequest","message":"integer too big (maximum 100, got 500) at $.limit","issues":[…]}
--- wrong method   (POST to a query)
HTTP/1.1 405 Method Not Allowed
{"error":"InvalidRequest","message":"Method not allowed"}
--- unknown nsid
HTTP/1.1 501 Not Implemented
{"error":"MethodNotImplemented","message":"XRPC method \"com.jjalcloud.feed.nope\" not implemented on this server"}
--- health
HTTP/1.1 200 OK
{"status":"ok"}
```

Note `limit` defaulted to `50` from the lexicon without the handler doing anything, and `/xrpc/_health`
is a reserved built-in path (`XRPC_PATH_PREFIX = '/xrpc/'`, `XRPC_HEALTH_CHECK_PATH = '/xrpc/_health'`,
`lex-router.ts:30-31`).

`@atproto/lex-server` also re-exports `serviceAuth()` for verifying inter-service JWTs
(`lex-server/src/index.ts` → `export * from './service-auth.js'`), which is what an AppView needs to
accept PDS-proxied requests.

### 3.4 Maturity risk on `LexRouter`

Nothing in the atproto monorepo runs it in production:

```
$ grep -rn "LexRouter" --include=*.ts packages | grep -v "lex-server/src"
packages/lex/lex-password-session/src/password-session.test.ts:6
packages/lex/lex-password-session/src/password-session.test.ts:61
packages/lex/lex-password-session/src/password-session.test.ts:147
packages/lex/lex-server/examples/subscription.ts:5
packages/lex/lex-server/examples/subscription.ts:32
```

Tests and one example. `bsky`, `pds`, and `ozone` all still run `@atproto/xrpc-server` on Express.
The package is at `0.1.14`.

### Comparison table

| | own NSID queries over `/xrpc/`? | how routes are registered | lexicon → handler wiring | error envelope | request validation | response validation |
| --- | --- | --- | --- | --- | --- | --- |
| **frontpage** | 2 endpoints only (`fyi.frontpage.feed.getFeedSkeleton`, `…describeFeedGenerator`); post/comment/vote data is not exposed | Next.js file-system routes; directory name is the literal NSID | none — handler is hand-written; codegen (`lex build`) used only for the **client** | hand-written 3-line helper returning `{error, message}` | hand-rolled `searchParams.get` + manual clamp | none on its own output; `$output.schema.assert()` on **inbound** third-party feed responses |
| **tangled** | AppView: **none**. knot/knotmirror/spindle/deliberi: ~30 endpoints | `chi` router, `r.Get("/"+tangled.RepoTreeNSID, …)`, mounted at `Mount("/xrpc", …)` | only the generated `…NSID` string constant | hand-written `XrpcError{Tag json:"error"; Message json:"message"}` + `writeError` | hand-rolled `r.URL.Query()` parsing | none |
| **bsky** | full surface (~120 endpoints) | `@atproto/xrpc-server` `Server`, `server.add(schema, {auth, handler})`; mounted via `app.use(server.router)` into Express | `lex build` runtime schemas passed to `server.add` (**not** `lex gen-server`) | framework-generated from `XRPCError.payload` → `{error, message}` | schema-driven (`createSchemaParamsVerifier`) | schema-driven, gated on `validateResponse` option |
| **(option) `LexRouter`** | n/a — library | `router.add(schema, handler)`; mounted anywhere a `Request→Response` fits | `lex build` runtime schemas | framework-generated `LexServerError.toResponse()` → `{error, message}` | schema-driven (`method.parameters.fromURLSearchParams`) | **none** — `// @TODO add validation of output` |

---

## 4. XRPC wire contract

Spec: <https://atproto.com/specs/xrpc>. Quotes are verbatim.

### 4.1 Path and method

> The HTTP request path starts with `/xrpc/`, followed by an NSID. Paths must always be top-level,
> not below a prefix. The NSID maps to the `id` field in the associated Lexicon.
>
> The two requests types that can be expressed in Lexicons are "query" (HTTP GET) and "procedure"
> (HTTP POST).

`LexRouter` enforces this and answers `405` on a mismatch (verified above). `xrpc-server` registers an
explicit wrong-method route that raises `InvalidRequestError` → `400`
(`xrpc-server/src/server.ts:205-211`, `"Incorrect HTTP method (${req.method}) expected POST"`).
**The two libraries disagree on the status code for wrong-method.**

### 4.2 Error response shape

> All unsuccessful responses should follow a standard error response schema. The `Content-Type`
> should be `application/json`, and the payload should be a JSON object with the following fields:
>
> - `error` (string, required): type name of the error (generic ASCII constant, no whitespace)
> - `message` (string, optional): description of the error, appropriate for display to humans
>
> The error type should map to an error name defined in the endpoint's Lexicon schema. … This is
> particularly encouraged on `400`, `500`, and `502` status codes.

`@atproto/xrpc-server`'s payload getter, `atproto/packages/xrpc-server/src/errors.ts:61-69`:

```ts
  get payload() {
    return {
      error: this.error,
      message:
        this.type === ResponseType.InternalServerError
          ? this.typeStr // Do not respond with error details for 500s
          : this.errorMessage || this.typeStr,
    }
  }
```

`@atproto/lex-server`'s equivalent, `atproto/packages/lex/lex-server/src/errors.ts:36-70`:

```ts
  public toResponse(): Response {
    const { status, headers } = this
    return Response.json(this.toJSON(), { status, headers })
  }

  static from(cause: unknown): LexServerError {
    if (cause instanceof LexServerError) return cause
    if (cause instanceof XrpcError) { … }
    // Convert @atproto/lex-schema validation errors to 400 Bad Request
    if (cause instanceof LexValidationError) {
      return new LexServerError(400, cause.toJSON(), undefined, { cause })
    }
    if (cause instanceof LexError) {
      return new LexServerError(500, cause.toJSON(), undefined, { cause })
    }
    return new LexServerError(500, { error: 'InternalServerError', message: 'An internal error occurred' }, undefined, { cause })
  }
```

Measured (my `probe2.ts` against Hono+Bun):

```
--- custom lexicon error   throw new LexServerError(400, {error:'UnknownFeed', message:'no such feed'})
HTTP/1.1 400 Bad Request
{"error":"UnknownFeed","message":"no such feed"}
--- unhandled throw        throw new Error('internal detail leak?')
HTTP/1.1 500 Internal Server Error
{"error":"InternalServerError","message":"An internal error occurred"}
```

Both libraries scrub the message on 500. **Caveat:** `LexRouter` adds a **non-spec third field**
`issues` to validation errors (seen in §3.3 output). The spec defines only `error` and `message`;
extra fields are not forbidden, and the spec's general rule is "Unexpected fields … should be
ignored" (Lexicon spec, *Authority and Control*), but `issues` can leak schema internals to clients.

### 4.3 Status-code map

Spec, *Summary of HTTP Status Codes* (verbatim list):

| Code | Spec meaning |
| --- | --- |
| `200 OK` | Success. "If there is a response body (optional), there should be a `Content-Type` header." |
| `400 Bad Request` | "Request was invalid, and was not processed" |
| `401 Unauthorized` | "Authentication is required for this endpoint. There should be a `WWW-Authenticate` header." |
| `403 Forbidden` | "The client lacks permission for this endpoint" |
| `404 Not Found` | "Can indicate a missing resource. This can also indicate that the server does not support atproto, or does not support this endpoint." |
| `413 Payload Too Large` | "Request body was too large." |
| `429 Too Many Requests` | "There may be a `Retry-After` header." |
| `500 Internal Server Error` | "Generic internal service error. Client may retry after a delay." |
| `501 Not Implemented` | "The specified endpoint is known, but not implemented. Client should *not* retry." |
| `502` / `503` / `504` | "temporary or permanent service downtime" |

`LexServerAuthError` implements the `401` + `WWW-Authenticate` requirement, including
`Access-Control-Expose-Headers: WWW-Authenticate` for CORS (`lex-server/src/errors.ts:110-123`).
`LexRouter` returns `501 MethodNotImplemented` for an unregistered NSID under `/xrpc/`
(`lex-router.ts:1038-1044`, verified above) and a non-standard `499 RequestAborted` when the client
aborts (`lex-router.ts:939-941`).

### 4.4 `Content-Type`

Spec: errors "should be `application/json`". For success, `Content-Type` comes from the lexicon's
`output.encoding`. Both libraries do this — `xrpc-server` via
`res.header('Content-Type', encoding)` (server.ts:499) and `lex-server` via `Response.json(...)`
when `method.output?.encoding === 'application/json'` (lex-router.ts:756-760). Observed on the wire:
`Content-Type: application/json;charset=utf-8`.

For **procedure input**, `lex-server` requires the request `Content-Type` to match the lexicon and
`400`s otherwise; a missing header with a body is assumed `application/octet-stream`:

`atproto/packages/lex/lex-server/src/lex-router.ts:1055-1071` (abridged)

```ts
  const encoding =
    encodingRaw ||
    (request.body != null && this.input.encoding != null ? 'application/octet-stream' : undefined)

  if (!this.input.matchesEncoding(encoding)) {
    throw new LexServerError(400, { error: 'InvalidRequest', message: `Invalid content-type: ${encoding}` })
  }
```

A `GET` carrying a body or a `content-type`/`content-length` header is rejected with `400`
(`lex-router.ts:1091-1099`).

### 4.5 Parameter encoding — arrays, booleans, defaults

Spec:

> Multiple query parameters with the same name can be used to represent an array of parameters. When
> encoding `boolean` parameters, the strings `true` and `false` should be used. Strings should not be
> quoted. If a `default` value is included in the schema, it should be included in every request to
> ensure consistent caching behavior.

I probed the actual `LexRouter` behaviour with a scratch lexicon
(`dev.probe.query` with `tags: array<string>`, `flag: boolean`, `n: integer`) echoing its parsed params:

| query string | response |
| --- | --- |
| `tags=a&tags=b&flag=true&n=3` | `{"echo":{"tags":["a","b"],"flag":true,"n":3}}` |
| `tags=a&flag=false` | `{"echo":{"tags":["a"],"flag":false}}` |
| `tags=a&tags=b&tags=a` | `{"echo":{"tags":["a","b","a"]}}` — duplicates preserved, order preserved |
| `tags[]=a&tags[]=b` | `{"echo":{"tags[]":["a","b"]}}` — bracket syntax **not** supported |
| `flag=1` | `400 {"error":"InvalidRequest","message":"Expected boolean value type (got \"1\") at $.flag", …}` |
| `flag=TRUE` | `400 …Expected boolean value type (got \"TRUE\")…` |
| `n=abc` | `400 …Expected integer value type (got \"abc\")…` |
| `unknown=zzz` | `200 {"echo":{"unknown":"zzz"}}` |

The legacy `xrpc-server` path behaves differently on three of these. Its decoder is lossy:

`atproto/packages/xrpc-server/src/util.ts:97-113`

```ts
export function decodeQueryParam(type: string, value: unknown): string | number | boolean | undefined {
  if (!value) { return undefined }
  if (type === 'string' || type === 'datetime') { return String(value) }
  if (type === 'float') { return Number(String(value)) }
  else if (type === 'integer') { return parseInt(String(value), 10) || 0 }
  else if (type === 'boolean') { return value === 'true' }
}
```

So under `xrpc-server`, `flag=1` silently becomes `false` and `n=abc` silently becomes `0`, rather
than `400`. It also supports the non-standard `foo[]=bar&foo[0]=baz` bracket form behind an opt-in
`paramsParseLoose` route option, described in-source as "non-standard and should only be used for
limited backwards-compatibility purposes" (`util.ts:128-133`).

### 4.6 Unknown parameters

**The spec is silent on unknown query parameters.** The closest normative statement is in the
Lexicon spec, about *data*, not params:

> Unexpected fields in data which otherwise conforms to the Lexicon should be ignored. When doing
> schema validation, they should be treated at worst as warnings.

Behaviour differs between the two server libraries:

- **`xrpc-server` strips them.** `decodeQueryParams` only writes a key when the lexicon declares it
  (`util.ts:73-94`: `const property = def.parameters?.properties?.[k]; if (property) { … }`).
- **`lex-server` passes them through** into `ctx.params` untouched (measured: `unknown=zzz` →
  `{"echo":{"unknown":"zzz"}}`).
- The raw lexicon validator also accepts them. Measured with `@atproto/lexicon`
  `Lexicons.assertValidXrpcParams` on our real `getSearch` lexicon:

```
{"q":"cat"}                 => OK {"q":"cat","limit":50}
{"q":"cat","bogus":"x"}     => OK {"q":"cat","bogus":"x","limit":50}
{"q":"cat","limit":500}     => THROW ValidationError limit can not be greater than 100
{}                          => OK {"limit":50}
```

Note the lexicon `default` is materialised into params by the validator in both stacks — so a
handler always sees `limit`, and caching keys must be computed accordingly.

### 4.7 Not handled for you: CORS

Spec: "CORS support is encouraged but not required." `LexRouter` explicitly defers it —
`lex-router.ts:713-714`: `// @NOTE CORS requests should be handled by a middleware before reaching this point.`
Measured: an `OPTIONS` preflight against a mounted `LexRouter` returns
`405 {"error":"InvalidRequest","message":"Method not allowed"}`. On Hono, `hono/cors` must be
installed *before* the `/xrpc/*` route. `bsky` does the same thing on the Express side:
`app.use(cors({ maxAge: DAY / SECOND }))` before mounting (`bsky/src/index.ts:76`).

### 4.8 Response validation is not free

`LexRouter` does **not** validate handler output. Source, `lex-router.ts:750`:

```ts
        // @TODO add validation of output based on method.output.schema?
```

Measured — a handler returning a body that violates its own lexicon is served as `200`:

```
--- invalid OUTPUT (schema violation)
HTTP/1.1 200 OK
{"gifs":[{"nonsense":true}],"extra":"not in schema"}
```

`xrpc-server` *does* validate output, via `createSchemaOutputVerifier` / `createLexiconOutputVerifier`,
gated by the `validateResponse` option (bsky sets it to `config.debugMode`, i.e. **off in production**).

---

## 5. External lexicon refs — the dangling `app.bsky.actor.defs#profileViewBasic`

### 5.1 Confirming the failure mode

`packages/common/lexicons/com/jjalcloud/feed/defs.json` refs `app.bsky.actor.defs#profileViewBasic`,
and the repo vendors only `app/bsky/actor/profile.json` and `com/atproto/repo/strongRef.json`.

Runtime (`@atproto/lexicon`, script `/tmp/lib-xrpc/gen/danglingref.mjs`):

```
loaded: app.bsky.actor.profile, com.atproto.repo.strongRef, com.jjalcloud.feed.defs, com.jjalcloud.feed.getSearch, com.jjalcloud.feed.gif, com.jjalcloud.feed.like, com.jjalcloud.graph.follow
Lexicons constructed OK (no eager ref resolution)
VALIDATE THREW: LexiconDefNotFoundError :: Lexicon not found: lex:app.bsky.actor.defs#profileViewBasic
```

Construction succeeds; the throw happens on the first `assertValidXrpcOutput`. Confirms the ticket's
diagnosis exactly.

Codegen also breaks, but only at the TypeScript layer. `lex gen-server` emits the file with a broken
import and exits `0`:

```
/tmp/lib-xrpc/gen/out/types/com/jjalcloud/feed/defs.ts:12
import type * as AppBskyActorDefs from '../../../app/bsky/actor/defs.js'
```

```
$ tsc --noEmit … out/index.ts out/types/com/jjalcloud/feed/defs.ts
out/types/com/jjalcloud/feed/defs.ts(12,40): error TS2307: Cannot find module '../../../app/bsky/actor/defs.js' or its corresponding type declarations.
```

### 5.2 What the reference implementations do: they don't depend on `app.bsky.*` at all

Cross-lexicon `ref`s across all of each project's own lexicons:

```
== frontpage external refs (lexicons/fyi/**):
"ref": "com.atproto.repo.strongRef"
"ref": "fyi.frontpage.richtext.block"

== tangled external refs (lexicons/**), non-local only:
"ref": "com.atproto.repo.strongRef"
"ref": "sh.tangled.…"   (24 distinct, all self-owned)
```

**Neither project references a single `app.bsky.*` definition.** The one foreign lexicon either
touches is `com.atproto.repo.strongRef` — a protocol-level, not app-level, type — and both **vendor
the JSON file into their own tree**:

- `frontpage/lexicons/com/atproto/repo/strongRef.json`
- `tangled/lexicons/com/atproto/repo/strongRef.json`

Frontpage vendors the whole `com.atproto.repo.*` group (12 files). Neither uses a git submodule.

Where tangled needs to carry an arbitrary foreign record inside its own view type, it uses
`"type": "unknown"` with a prose description rather than a `ref` — exactly the pattern our `gifView.value`
already uses:

`tangled/lexicons/feed/listStars.json` (`#listItem`)

```json
"value": {
  "type": "unknown",
  "description": "Embedded sh.tangled.feed.star record"
}
```

So the observed convention is: **own everything you name in a `ref`; vendor `com.atproto.*` when you
must; use `unknown` for foreign payloads.** Redefining your own view type is the norm, not the
exception — tangled declares its own `sh.tangled.actor.profile` and `sh.tangled.actor.getProfile`
rather than reusing `app.bsky.actor.defs`. [INFERENCE] the motive is avoiding exactly this coupling;
neither repo states a reason.

### 5.3 There is now a real dependency manager, and it works

`@atproto/lex@0.3.6` ships `lex install`, which resolves foreign lexicons over the network
(DNS `_lexicon` TXT → DID → PDS → `com.atproto.lexicon.schema` record; Lexicon spec,
*Lexicon Publication and Resolution*), vendors the JSON into `lexicons/`, and writes a lockfile
pinning `at://` URI + CID. This is where frontpage's `lexicons.json` comes from
(`frontpage/lexicons.json:1-20`):

```json
{
  "version": 1,
  "lexicons": ["com.atproto.repo.createRecord", …],
  "resolutions": {
    "com.atproto.repo.createRecord": {
      "uri": "at://did:plc:6msi3pj7krzih5qxqtryxlzw/com.atproto.lexicon.schema/com.atproto.repo.createRecord",
      "cid": "bafyreihyvpmy2l4ou2v5etx25j5lbqty6tvna7gsxdqge76rbb7gltulei"
    },
```

I ran it against a copy of this repo's `lexicons/` to see what fixing our dangling ref actually costs:

```
$ lex install app.bsky.actor.defs
Fetching lexicon from at://did:plc:4v4y5r3lwsbtmsxhile2ljac/com.atproto.lexicon.schema/app.bsky.actor.status...
Fetching lexicon from at://did:plc:4v4y5r3lwsbtmsxhile2ljac/com.atproto.lexicon.schema/app.bsky.embed.external...
…
Re-using existing lexicon com.atproto.repo.strongRef
Resolving dependency lexicon: app.bsky.richtext.facet
Resolving dependency lexicon: app.bsky.feed.defs
…
Resolving dependency lexicon: tools.ozone.report.defs
```

**One `ref` pulls in 21 files** — the transitive closure of `app.bsky.actor.defs`:

```
app/bsky/actor/defs.json          app/bsky/embed/recordWithMedia.json   com/atproto/label/defs.json
app/bsky/actor/status.json        app/bsky/embed/video.json             com/atproto/moderation/defs.json
app/bsky/embed/defs.json          app/bsky/feed/defs.json               com/atproto/repo/strongRef.json
app/bsky/embed/external.json      app/bsky/feed/postgate.json           tools/ozone/report/defs.json
app/bsky/embed/gallery.json       app/bsky/feed/threadgate.json
app/bsky/embed/images.json        app/bsky/graph/defs.json
app/bsky/embed/record.json        app/bsky/labeler/defs.json
                                  app/bsky/notification/defs.json
                                  app/bsky/richtext/facet.json
```

After that, `lex build` generates `com/jjalcloud/feed/defs.defs.ts` with a resolvable
`import * as ActorDefs from '../../../app/bsky/actor/defs.defs.js'` and the runtime `validate()` no
longer throws. `lex install --ci` fails the build if installed files drift from the pinned CIDs, and
`--update` re-resolves.

The trade: our `com.jjalcloud.feed.gifView` output would then be schema-bound to `app.bsky`'s
moderation and embed vocabulary — labels, `tools.ozone.report.defs`, threadgates — and our hydration
would have to produce a full `profileViewBasic` (which today it fakes from `public.api.bsky.app`).
Redefining a minimal `com.jjalcloud.actor.defs#profileViewBasic` of our own is the alternative both
reference AppViews actually took. **This is the human's call.**

---

## 6. Discoverability — how does anyone find our `/xrpc/`?

**There is no `.well-known` endpoint that advertises an AppView.** Discovery is via the service's
**DID document `service` array**, and the client must already know the DID (or the hostname) out of
band.

The complete set of `.well-known` paths in the atproto monorepo:

| path | purpose |
| --- | --- |
| `/.well-known/did.json` | resolves a `did:web` identity (`identity/src/did/web-resolver.ts:9`, `DOC_PATH`) |
| `/.well-known/atproto-did` | handle → DID resolution (`identity/src/handle/index.ts:50`) |
| `/.well-known/oauth-authorization-server` | OAuth AS metadata |
| `/.well-known/oauth-protected-resource` | OAuth RS metadata |
| `/.well-known/change-password` | W3C change-password URL |
| `/.well-known/ozone-metadata.json` | Ozone-specific, `{did, url}` (`ozone/src/api/well-known.ts:37`) |

None of these enumerate XRPC methods. bsky's own AppView advertises itself only through a DID doc
service entry:

`atproto/packages/bsky/src/api/well-known.ts:12-40`

```ts
    router.get('/.well-known/did.json', (_req, res) => {
      res.json({
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
        id: did,
        verificationMethod: [{ id: `${did}#atproto`, type: 'Multikey', controller: did, publicKeyMultibase: … }],
        service: [
          { id: '#bsky_notif', type: 'BskyNotificationService', serviceEndpoint },
          { id: '#bsky_appview', type: 'BskyAppView', serviceEndpoint },
        ],
      })
    })
```

Clients then reach it through PDS proxying, per the XRPC spec:

> The HTTP header is `atproto-proxy`, and the value is a DID (identifying a service), followed by a
> service endpoint identifier, joined by a `#` character. The PDS resolves the service DID, extracts
> a service endpoint URL from the DID document, and proxies the request on to the identified server.
>
> - the target service must have a resolvable DID, a well-formed DID document, and a corresponding
>   service entry with a matching identifier
> - only atproto endpoint paths are supported. This means an `/xrpc/` prefix, followed by a valid NSID

`LexRouter` already reads and parses that header but has not implemented forwarding
(`lex-router.ts:1030-1033`, `// @TODO actually implement service proxying logic here`) — irrelevant
for us as a *receiving* AppView, which just needs a DID doc entry plus `serviceAuth()` verification.

The spec is blunt about method-level discovery:

> Not all endpoints require authentication, but there is not yet a consistent way to enumerate which
> endpoints do or do not.

There is no `describeServer`-style listing for AppViews. What the two reference projects do:

- **frontpage** publishes a hand-written DID doc with a **custom, non-standard service type**, and
  the note that it is receive-only:

  `frontpage/apps/frontpage/app/.well-known/did.json/route.ts:6-18`

  ```ts
  // This is a receive-only identity — Frontpage verifies incoming JWTs but
  // does not sign outbound ones, so no verificationMethod is needed.
  const DID_DOCUMENT = {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: publicConfig.NEXT_PUBLIC_FEED_SERVICE_DID,
    service: [{ id: "#frontpage_fg", type: "FrontpageFeedGenerator", serviceEndpoint: `https://${FRONTPAGE_ATPROTO_HANDLE}` }],
  };
  ```

  Its `fyi.frontpage.feed.describeFeedGenerator` endpoint then lists the feeds that service offers —
  a per-app discovery convention modelled on the bsky feed-generator contract, not a protocol one.

- **tangled** makes each knot a `did:web` at its own hostname and serves the doc there
  (`knot2/crates/knot-server/src/main.rs:634-638`, route `/.well-known/did.json`). Its README
  documents the bootstrap as two bare curls:

  `tangled/knot2/README.md:290-294`

  ```
  curl -s https://knot.oyster.cafe/xrpc/sh.tangled.owner
  curl -s https://knot.oyster.cafe/.well-known/did.json
  ```

  > `sh.tangled.owner` returns the first DID in `server.admins`, which is what the Tangled appview
  > reads to confirm the operator is who they say they are when they register the knot.

  The hostname itself is supplied out of band — a human types it into the appview's knot registration
  form.

The one machine-readable thing we *can* publish that a stranger could find without knowing our URL is
the **lexicon** itself, via `com.atproto.lexicon.schema` records + a `_lexicon.jjalcloud.com` DNS TXT
record (Lexicon spec, *Lexicon Publication and Resolution*). That publishes the *schema*, not the
*endpoint*. `@atproto/lexicon-resolver`'s `resolveLexicon('app.bsky.feed.post')` is the client side
of that. Note nothing in the spec links a resolved lexicon back to a serving host.

---

## What this decides / does not decide

**Decides for [#10 (XRPC 표면의 범위)](https://github.com/huketo/jjalcloud/issues/10):** the framing
"generated `Server` vs. hand-written Hono routes" is a false binary. `lex gen-server` → Express is
genuinely closed to us (§3.1–3.2, proven under Bun). A third option exists and demonstrably works on
Hono/Bun today with our own lexicon and a one-line seam, `app.all('/xrpc/*', c => xrpc.fetch(c.req.raw))`
(§3.3). Whether its `0.1.x` / zero-production-users status (§3.4) and missing output validation (§4.6)
are acceptable is a judgement call, not a fact I can settle.

**Unblocks the lexicon-validation defect:** whichever server we pick, request-side validation comes
free from `lex build` schemas (§4.5, §4.6). Response-side validation is free only on the legacy
Express path, and even bsky runs it off in production — so "validate on read" needs its own decision
regardless.

**Reshapes the dangling-ref work:** §5.1 confirms `validate()` throws today and `tsc` fails on the
generated types. §5.3 shows `lex install app.bsky.actor.defs` fixes it mechanically at the cost of
vendoring 21 files and inheriting `app.bsky`'s moderation/embed vocabulary. §5.2 shows both
reference AppViews chose the other branch and never ref `app.bsky.*` at all.

**Reshapes the profile-hydration defect** (hardcoded `public.api.bsky.app`): if we keep the
`app.bsky.actor.defs#profileViewBasic` ref, our output schema *requires* whatever `profileViewBasic`
declares, which is why hydration reaches for bsky's AppView. Owning
`com.jjalcloud.actor.defs#profileViewBasic` decouples the two. These are one decision, not two.

**Does not decide** — for a human:

1. `LexRouter` (`0.1.14`, Fetch-native, no output validation, no production users in-repo) vs.
   hand-written Hono routes with hand-rolled `{error, message}` like frontpage and tangled. Both are
   defensible; the reference implementations closest to us chose hand-written, but they predate
   `lex-server`.
2. Vendor `app.bsky.actor.defs` via `lex install` (21 files, real coupling) **or** define
   `com.jjalcloud.actor.defs#profileViewBasic` ourselves (the frontpage/tangled convention). This
   also settles what `TAP_SIGNAL_COLLECTION`-adopted foreign repos' authors look like in our output.
3. Whether our DID is `did:web:jjalcloud.com` (serve `/.well-known/did.json` ourselves, like tangled's
   knots) or a `did:plc`. Either way we must publish a `service` entry with a chosen `id`/`type`
   fragment before any PDS will proxy `atproto-proxy: <our-did>#<fragment>` to us. There is no
   registry — the fragment name is ours to invent, as `#frontpage_fg` and `#bsky_appview` both are.
4. Whether we ship `com.atproto.lexicon.schema` records + a `_lexicon.jjalcloud.com` TXT record so
   third parties can resolve our NSIDs. Nothing in the protocol makes this discover our *endpoint* —
   it only makes our *schema* resolvable.
5. Whether `/xrpc/_health` being reserved by `LexRouter` conflicts with anything we plan (it answers
   `{"status":"ok"}` by default, overridable via the `healthCheck` option).

**Not investigated:** subscriptions (`LexRouter` supports WebSocket subscriptions via `ws`; we have
no subscription lexicon), rate limiting (`xrpc-server` has `rate-limiter-flexible` built in;
`lex-server` has none), and blob serving.
