# Infrastructure Research: AT Protocol Services Beyond Cloudflare Workers

## 1. AT Protocol OAuth in Serverless/Edge Environments

### Why It's Difficult

AT Protocol OAuth is one of the most complex OAuth implementations in production use. It mandates:

- **DPoP (Demonstrating Proof-of-Possession):** Every token is bound to a unique DPoP key pair. The client must generate, store, and use these keys to create signed DPoP proofs for every request. `dpop_bound_access_tokens` must be `true` for all clients.
- **PAR (Pushed Authorization Requests):** The authorization flow starts with a server-to-server POST, not a simple redirect.
- **Confidential Client JWT Authentication:** Confidential clients must use `private_key_jwt` for token endpoint auth, requiring persistent private key material and JWK/JWKS hosting.
- **Mandatory PKCE:** All flows require Proof Key for Code Exchange.
- **Session persistence:** Access tokens, refresh tokens, and DPoP key pairs must survive across requests and be restored from storage.

### Specific Pain Points in Cloudflare Workers

| Problem | Detail |
|---|---|
| **`fetch()` API differences** | Workers' `fetch()` doesn't support `cache: 'no-cache'` or `redirect: 'error'` — both used internally by `@atproto/oauth-client`. Requires patching/workarounds. |
| **No native Node.js `crypto`** | `@atproto/oauth-client-node` depends on `@atproto/jwk-jose` which uses the `jose` library with Node.js-specific crypto. The `jose` library throws `JOSENotSupported` errors when generating ECDSA P-256 keys in non-Node.js runtimes. |
| **Stateless execution model** | Workers are stateless by default. OAuth requires persistent session state (tokens, DPoP keys, PKCE verifiers) across multiple HTTP requests spanning minutes. |
| **DPoP key restoration** | When loading session state from KV, the `dpopKey` must be manually reconstructed into a `JoseKey` instance — it doesn't deserialize automatically. |
| **DNS handle resolution** | AT Protocol handle resolution via DNS (`_atproto` TXT records) isn't available in Workers. Must fall back to HTTP-based resolution via `https://bsky.social/xrpc/com.atproto.identity.resolveHandle`. |
| **No long-lived processes** | Token refresh requires background processes or cron-based refresh. Workers can't maintain persistent in-memory token caches. |
| **Durable Objects limitations** | While DOs add statefulness, they can't hold outbound WebSocket client connections during hibernation — only server-side WebSocket connections hibernate properly. |

### What `@atproto/oauth-client-node` Requires

The package is designed for traditional Node.js server environments and requires:

1. **Node.js crypto module** — for JWT signing, DPoP proof generation, key pair operations
2. **Persistent key-value storage** — `NodeSavedSessionStore` and `NodeSavedStateStore` interfaces expect a database or filesystem-backed store that persists across requests
3. **Long-lived process** — the client manages token refresh internally, expecting to run in a persistent server process
4. **`node:crypto` compatible runtime** — the `jose` dependency uses Node.js-specific crypto APIs not available in WinterCG/Workers runtimes
5. **JWK/JWKS endpoint hosting** — confidential clients must serve their public keys at a stable URL

**Workaround options:**
- Use `@tijs/atproto-oauth` (a framework-agnostic alternative designed for edge/serverless runtimes like Val Town and Deno Deploy)
- Manually reconstruct DPoP keys from KV storage using `new JoseKey(storedKey.jwks)`
- Proxy OAuth flows through a traditional server while keeping other logic in Workers

**Reference:** [GitHub Issue #3292 — OAuth client in CloudFlare environments](https://github.com/bluesky-social/atproto/issues/3292)

---

## 2. AT Protocol AppView Implementation

### Architecture Overview

```
User Device
    │
    ▼
┌─────────┐     proxies API calls     ┌──────────┐
│   PDS    │ ──────────────────────► │  AppView  │
│ (user's) │                          │ (indexes  │
└─────────┘                          │  + serves) │
                                      └──────────┘
                                           ▲
                                           │ consumes firehose
                                      ┌──────────┐
                                      │  Relay    │
                                      │(firehose) │
                                      └──────────┘
                                           ▲
                                           │ crawls repos
                                    ┌──────────────┐
                                    │  All PDSes   │
                                    │ (network)    │
                                    └──────────────┘
```

- **PDS (Personal Data Server):** Stores user repos and blobs, handles auth, proxies client requests to AppView
- **Relay:** Crawls all PDSes, aggregates updates into the firehose stream
- **AppView:** Consumes firehose, indexes data, serves query APIs (feeds, profiles, threads, search)
- **Frontend/Client:** Talks only to user's PDS, which proxies to AppView transparently

### What Running an AppView Requires

#### Core Functionality
1. **Firehose consumption** — persistent WebSocket connection to Relay or Jetstream, processing ~1,000+ events/second at full network scale
2. **Record indexing** — parse, validate, and store records (posts, likes, follows, reposts, blocks, profiles) into a queryable database
3. **View materialization** — transform raw indexed records into API responses (feed views, thread views, profile views, notifications)
4. **Identity resolution** — resolve DIDs to handles via PLC directory, handle DNS/HTTP resolution
5. **Search indexing** — full-text search, type-ahead matching, ranking
6. **Media processing** — thumbnail generation, blob proxying
7. **Label/moderation integration** — consume and apply content labels
8. **Account status tracking** — handle deleted, deactivated, and taken-down accounts

#### Infrastructure Requirements

| Component | Purpose | Scale Notes |
|---|---|---|
| **PostgreSQL** | Primary data store for indexed records | Bluesky's reference uses PostgreSQL 17 |
| **Redis** | Caching, rate limiting | Used by Blacksky's production AppView |
| **OpenSearch/Elasticsearch** | Full-text search | For post search, user search, type-ahead |
| **Persistent process** | Firehose consumer | Must maintain WebSocket connection 24/7 |
| **Background workers** | Backfill, maintenance | Separate from live indexing |
| **Blob storage** | Media/thumbnails | Can use S3-compatible storage |

#### Scale Considerations

- **Full network indexing:** ~2.2 GB of disk space per day for indexes (posts, likes, reposts, follows, blocks). Raw firehose data is ~200 GB/day.
- **Partial/community AppView:** Requirements scale linearly with indexed accounts. A community of a few thousand users is very manageable.
- **Performance:** The TypeScript firehose consumer processes events sequentially. At ~1,000 events/second, a full backfill would take ~6.5 years. Rust-based alternatives like `rsky-wintermute` target 10,000+ records/sec with parallel processing.

### Existing AppView Implementations

| Implementation | Language | Notes |
|---|---|---|
| **Bluesky official** (`bsky-appview`) | TypeScript/Node.js | Full production, massive scale, not easily self-hosted |
| **Blacksky** | TypeScript (fork) | Performance-optimized fork with caching, community features |
| **AppViewLite** | C# (.NET) | Lightweight, focused on low resource consumption, ~2.2 GB/day disk |
| **ATCR AppView** | Unknown | Community implementation |

### What This Means for jjalcloud

You do NOT need a full AppView. For a GIF/meme service, you need:
- **Partial indexing** — only index your app's Lexicon records (e.g., `cloud.jjal.*`)
- **Jetstream consumer** — filter for only your collection, much lighter than full firehose
- **Simple view serving** — materialize views for your specific UI needs
- **OAuth for user actions** — likes, uploads, etc.

This is closer to a "mini AppView" or "application backend" than a full Bluesky AppView.

---

## 3. Low-Cost Cloud Infrastructure Comparison

### Requirements Summary

For a small-to-medium AT Protocol service (like jjalcloud), you need:
- 1-2 always-on containers (web server + firehose consumer)
- PostgreSQL database (small, <5 GB initially)
- Background workers / cron jobs
- OAuth server with persistent session state
- SSR web serving
- Persistent outbound WebSocket (Jetstream)

### Platform Comparison

#### a) Railway

| Aspect | Details |
|---|---|
| **Pricing model** | $5/mo Hobby plan + usage-based overage |
| **Compute** | ~$0.000463/vCPU-second, ~$0.000000231/GB-second |
| **PostgreSQL** | Built-in, usage-billed. Small DB runs ~$0.55-5/mo |
| **WebSockets** | Supported, long-lived connections work |
| **Cron/Workers** | Supported via separate services or cron triggers |
| **Deploy** | Git push, Dockerfile, or Nixpacks auto-detection |
| **Estimated cost** | **$5-15/mo** for 1 app + 1 worker + small PostgreSQL |
| **Pros** | Simplest DX, usage-based = cheap for small scale, instant Postgres |
| **Cons** | Can exceed $5 credit quickly with always-on services, no free tier for compute |

#### b) Fly.io

| Aspect | Details |
|---|---|
| **Pricing model** | Usage-based, pay for Machines by the second |
| **Compute** | Shared-CPU 256MB VM ~$1.94/mo always-on |
| **PostgreSQL** | Managed Postgres Basic at $38/mo (expensive!). Or self-managed Postgres on a Fly Machine ~$5-10/mo |
| **WebSockets** | Excellent support, designed for long-lived connections |
| **Cron/Workers** | Run as separate Machines, scale-to-zero capable |
| **Deploy** | Dockerfile-based, `fly launch` CLI |
| **Estimated cost** | **$15-50/mo** (cheap if self-managed Postgres, expensive with managed) |
| **Pros** | Global edge deployment, great for WebSockets, Machines API is powerful |
| **Cons** | Managed Postgres is expensive ($38/mo minimum), hidden costs (IPv4 $2/mo, volume billing), complexity |

#### c) Render

| Aspect | Details |
|---|---|
| **Pricing model** | Fixed monthly per service |
| **Compute** | Web service from $7/mo (512MB). Background worker from $7/mo |
| **PostgreSQL** | Managed, from $7/mo (256MB RAM, 1GB storage — tiny). Production-grade from $20/mo |
| **Cron Jobs** | From $1/mo |
| **WebSockets** | Supported on web services |
| **Deploy** | Git push, Docker, auto-detection |
| **Estimated cost** | **$22-40/mo** (web $7 + worker $7 + Postgres $7 + cron $1) |
| **Pros** | Predictable pricing, good docs, free tier for static sites, built-in cron |
| **Cons** | Fixed pricing less efficient for low-usage, starter DB is very small, cold starts on free tier |

#### d) Coolify on Hetzner VPS

| Aspect | Details |
|---|---|
| **Pricing model** | VPS cost + Coolify (free self-hosted) |
| **VPS** | Hetzner CX22: 2 vCPU / 4GB RAM / 40GB NVMe — **€3.49/mo** (~$3.80) |
| **VPS (bigger)** | Hetzner CX33: 4 vCPU / 8GB RAM / 80GB NVMe — **€5.49/mo** (~$6.00) |
| **PostgreSQL** | Self-managed via Docker on same VPS — $0 extra |
| **Coolify** | Free (self-hosted). Provides web dashboard, git deploys, SSL, Docker management |
| **WebSockets** | Full support (it's just Docker on Linux) |
| **Estimated cost** | **$4-8/mo** total |
| **Pros** | Cheapest option by far, full control, no vendor lock-in, Coolify provides PaaS-like UX |
| **Cons** | You manage the server (updates, security, backups), single point of failure, no auto-scaling, requires Linux knowledge |

#### e) Traditional VPS with Docker

| Aspect | Details |
|---|---|
| **Hetzner** | CX22: €3.49/mo (2 vCPU/4GB). Best value. 32 regions via Hetzner Cloud |
| **DigitalOcean** | $4/mo (1 vCPU/512MB) to $12/mo (1 vCPU/2GB). Best docs/community |
| **Vultr** | $2.50/mo (1 vCPU/512MB) to $6/mo (1 vCPU/1GB). 32 global regions. 15-20% cheaper than DO |
| **Setup** | Docker Compose with Node.js app + PostgreSQL + worker |
| **Estimated cost** | **$3.50-12/mo** depending on provider and specs |
| **Pros** | Maximum control, cheapest, can run everything on one box |
| **Cons** | Full ops responsibility, no deployment UX, manual SSL/backups/monitoring |

#### f) Hybrid Approach (Recommended)

Keep Cloudflare for what it does best, run compute elsewhere:

| Layer | Platform | Purpose | Cost |
|---|---|---|---|
| **CDN / Static** | Cloudflare Pages (free) | Static assets, SPA shell, image CDN | $0 |
| **Edge Logic** | Cloudflare Workers (free tier) | URL routing, redirects, cache rules, rate limiting | $0 |
| **DNS** | Cloudflare DNS (free) | DNS management, proxy | $0 |
| **R2 Storage** | Cloudflare R2 | Blob/media storage (free egress!) | ~$0-1/mo |
| **Compute** | Railway or Hetzner+Coolify | Node.js app, OAuth, SSR, Jetstream consumer | $5-15/mo |
| **Database** | On compute platform | PostgreSQL | included |
| **Total** | | | **$5-16/mo** |

This gives you:
- Free CDN and static hosting (Cloudflare Pages)
- Free blob storage with free egress (R2)
- Proper Node.js runtime for OAuth, Jetstream, SSR
- PostgreSQL for relational data
- No serverless constraints on crypto, WebSockets, or sessions

#### g) Other Options Worth Noting

| Platform | Notes | Cost |
|---|---|---|
| **Koyeb** | Serverless containers, free tier (1 nano instance), WebSocket support | $0-7/mo |
| **Northflank** | Developer platform, free tier, managed DBs | $0-20/mo |
| **Dokku** (self-hosted) | Heroku-like PaaS on your own VPS, lighter than Coolify | VPS cost only |
| **Kamal** (by 37signals) | Docker deployment tool, no PaaS overhead, used by HEY/Basecamp | VPS cost only |
| **Oracle Cloud Free Tier** | 4 ARM cores, 24GB RAM, 200GB — permanently free (if available) | $0 |

### Cost Summary Table

| Platform | Estimated Monthly Cost | Ops Effort | Best For |
|---|---|---|---|
| Railway | $5-15 | Very Low | Fastest to start, good for prototyping → production |
| Render | $22-40 | Low | Teams wanting predictable bills |
| Fly.io | $15-50 | Medium | Global distribution, WebSocket-heavy apps |
| Coolify + Hetzner | $4-8 | Medium | Best value with PaaS UX |
| Raw VPS + Docker | $3.50-12 | High | Maximum control, cheapest |
| Hybrid (CF + Railway) | $5-16 | Low-Medium | Best of both worlds |

---

## 4. Migration from Cloudflare Workers + D1

### Migration Path Overview

```
Phase 1: Set up target          Phase 2: Migrate data         Phase 3: Cut over
─────────────────────           ──────────────────────        ─────────────────
• Provision VPS/PaaS            • Export D1 via wrangler      • DNS switch
• Set up PostgreSQL             • Convert SQLite → PG         • Monitor
• Port app to Node.js/Express   • Validate data integrity     • Decommission Workers
• Set up OAuth properly         • Run both in parallel        • Keep CF for CDN
```

### D1 (SQLite) → PostgreSQL Migration

#### Step 1: Export from D1

```bash
# Export full database as SQL
npx wrangler d1 export <DATABASE_NAME> --remote --output=./d1-export.sql

# Export specific table
npx wrangler d1 export <DATABASE_NAME> --remote --table=<TABLE_NAME> --output=./table.sql

# Export schema only (no data)
npx wrangler d1 export <DATABASE_NAME> --remote --no-data --output=./schema.sql

# Download as native SQLite file (legacy backup method)
npx wrangler d1 backup download <DATABASE_NAME> <BACKUP_ID>
```

**Limitations:** Export doesn't support virtual tables. Files limited to 5 GiB. D1 databases cap at 10 GB.

#### Step 2: Schema Conversion (SQLite → PostgreSQL)

Key differences to address:

| SQLite | PostgreSQL | Action |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` or `GENERATED ALWAYS AS IDENTITY` | Replace |
| `TEXT` | `TEXT` or `VARCHAR(n)` | Usually compatible |
| `INTEGER` (boolean 0/1) | `BOOLEAN` | Convert column type + data |
| `REAL` | `DOUBLE PRECISION` or `NUMERIC` | Usually compatible |
| `BLOB` | `BYTEA` | Replace type |
| Case-insensitive table names | Case-sensitive (lowercase convention) | Normalize to lowercase |
| `datetime('now')` | `NOW()` or `CURRENT_TIMESTAMP` | Replace function calls |
| `LIKE` (case-insensitive by default) | `ILIKE` (for case-insensitive) | Replace operator |
| No strict typing | Strict typing | Review all data for type violations |
| `||` for concat | `||` for concat | Compatible |
| `GROUP_CONCAT()` | `STRING_AGG()` | Replace function |
| `IFNULL()` | `COALESCE()` | Replace function |
| No `ALTER TABLE DROP COLUMN` (old SQLite) | `ALTER TABLE DROP COLUMN` | PostgreSQL is more flexible |

**Tools:**
- **pgloader** — automated SQLite → PostgreSQL migration with type mapping
- **Manual conversion** — for small schemas, just rewrite the DDL

#### Step 3: Application Code Changes

| Workers / D1 Pattern | Node.js / PostgreSQL Equivalent |
|---|---|
| `env.DB.prepare(sql).bind(...).all()` | `pg.query(sql, [...params])` or use Drizzle/Kysely |
| `env.DB.batch([...])` | PostgreSQL transaction with multiple queries |
| `env.KV.get/put` | PostgreSQL table or Redis |
| `env.R2.get/put` | Keep using R2 via S3-compatible API, or switch to local/S3 |
| Wrangler `--local` dev | Docker Compose with PostgreSQL container |
| `export default { fetch() }` | Express/Hono/Fastify HTTP server |
| Durable Objects | In-memory state + PostgreSQL (or Redis for distributed) |
| Cron Triggers | node-cron, or OS-level crontab, or platform cron |

#### Step 4: Transition Period Strategy

1. **Run both in parallel** — keep Workers serving traffic while new server is being tested
2. **Use Cloudflare DNS** — easy to switch origin by changing DNS records (proxied mode)
3. **Feature flag** — route a percentage of traffic to new backend via Workers
4. **Keep R2** — continue using Cloudflare R2 for blob storage even after migration (free egress is valuable)
5. **Keep Pages** — serve static assets from Cloudflare Pages, proxy API calls to new backend
6. **Monitor** — compare response times, error rates between old and new

#### Recommended Migration Order

1. **First: OAuth** — move to proper Node.js server (biggest pain point in Workers)
2. **Second: Jetstream consumer** — move to persistent process (eliminates DO/cron workarounds)
3. **Third: SSR + API** — move web serving to same server
4. **Fourth: Database** — migrate D1 → PostgreSQL
5. **Last: DNS cutover** — point domain to new server, keep CF as reverse proxy/CDN

### What to Keep on Cloudflare (Even After Migration)

- **Cloudflare DNS** — free, excellent performance
- **Cloudflare CDN/proxy** — free caching, DDoS protection, SSL termination
- **Cloudflare Pages** — free static site hosting (if applicable)
- **Cloudflare R2** — $0 egress, S3-compatible, great for media/blobs
- **Cloudflare Workers** — lightweight edge logic (redirects, headers, A/B routing)

---

## Summary Recommendations

### For jjalcloud specifically:

1. **Short-term (cheapest, fastest):** Railway ($5-15/mo)
   - Deploy Node.js app with Hono/Express
   - Built-in PostgreSQL
   - Jetstream consumer as a separate Railway service
   - OAuth with `@atproto/oauth-client-node` (works properly in Node.js)
   - Keep Cloudflare for DNS + CDN + R2

2. **Medium-term (best value):** Coolify on Hetzner CX33 ($6/mo)
   - Self-hosted PaaS with web dashboard
   - Docker Compose: app + worker + PostgreSQL
   - Full control, no usage caps
   - Keep Cloudflare for DNS + CDN + R2

3. **If staying on Cloudflare:** Accept the OAuth limitations
   - Use workarounds (manual DPoP key restoration, KV session storage)
   - Use Cron Triggers for Jetstream polling (not ideal)
   - Consider `@tijs/atproto-oauth` instead of official client
   - This path has ongoing friction and maintenance burden

### Key Insight

The fundamental tension is that AT Protocol's OAuth and real-time data consumption (firehose/Jetstream) are designed for **stateful, long-running server processes** — exactly what serverless/edge architectures are designed to eliminate. A $4-6/mo VPS with Docker gives you everything AT Protocol needs without fighting the platform.
