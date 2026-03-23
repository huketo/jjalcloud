# jjalcloud v2

AT Protocol 기반 탈중앙 GIF 공유 플랫폼. Tenor API v2 호환으로 Tenor 대체 서비스를 목표합니다.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono (SSR + API + XRPC)
- **Database**: PostgreSQL 18 (Drizzle ORM, `bun:sql` native driver)
- **Storage**: Cloudflare R2 / Garage (`Bun.S3Client` native)
- **AT Protocol**: atcute ecosystem (OAuth, XRPC server, Jetstream, lexicon codegen)
- **Deploy**: Railway (Dockerfile)
- **CDN**: Cloudflare DNS + CDN + Image Resizing

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- [Docker](https://docs.docker.com/get-docker/) (for local dev)

### Installation

```bash
bun install
```

### Local Development

```bash
# Start infrastructure (PostgreSQL, PDS, Garage)
docker compose up -d

# Initialize Garage S3 storage (first time only)
bun run scripts/garage-init.ts

# Seed test accounts on PDS
bun run test:setup

# Start dev server
bun run dev
```

### Testing

```bash
# Unit & route tests (no infra needed)
bun test src/

# Integration tests (requires Docker)
bun test tests/integration/
```

### Lexicon Codegen

```bash
bun run codegen
```

### Database Migrations

```bash
bun run db:generate
bun run db:migrate
```

## Project Structure

```
jjalcloud/
├── src/
│   ├── server.ts              # Bun + Hono entrypoint
│   ├── env.ts                 # Environment validation (Zod)
│   ├── routes/
│   │   ├── web/               # SSR pages (Hono JSX)
│   │   ├── tenor/             # Tenor API v2 compatible endpoints
│   │   ├── xrpc/              # AT Protocol AppView (XRPC)
│   │   ├── oauth/             # AT Protocol OAuth flow
│   │   └── api/               # Internal API
│   ├── indexer/
│   │   ├── jetstream.ts       # Jetstream consumer (multi-URL fallback)
│   │   ├── handlers.ts        # Event handlers (gif/like)
│   │   └── media.ts           # R2 cache + ffmpeg conversion
│   ├── db/
│   │   ├── schema.ts          # Drizzle PostgreSQL schema
│   │   ├── client.ts          # Database client (bun:sql)
│   │   └── migrations/        # SQL migrations
│   ├── auth/                  # OAuth stores + client
│   ├── lexicon/               # Generated TypeScript types
│   └── lib/
│       ├── r2.ts              # S3 client (Bun.S3Client)
│       ├── search.ts          # Full-text search, trending
│       ├── tenor-adapter.ts   # AT record → Tenor GifObject
│       └── identity.ts        # DID/Handle resolution
├── lexicons/                  # AT Protocol lexicon definitions
├── tests/
│   ├── helpers/               # Test utilities (db, s3, pds)
│   └── integration/           # Integration tests
├── scripts/
│   ├── garage-init.ts         # Garage S3 initialization
│   ├── garage.toml            # Garage configuration
│   └── init-db.sh             # DB migration for Docker
├── docker-compose.yml         # PostgreSQL 18 + PDS + Garage
├── Dockerfile                 # Railway deployment
├── wrangler.toml              # Cloudflare R2 config
└── drizzle.config.ts          # Drizzle Kit config
```

## API Endpoints

### Tenor API v2 (Compatible)

| Endpoint | Description |
|---|---|
| `GET /v2/search` | Search GIFs by keyword |
| `GET /v2/featured` | Trending GIFs |
| `GET /v2/categories` | Category list |
| `GET /v2/autocomplete` | Tag autocomplete |
| `GET /v2/search_suggestions` | Related tags |
| `GET /v2/posts` | GIFs by ID |
| `POST /v2/registershare` | Share event tracking |

### AT Protocol XRPC

| Endpoint | Description |
|---|---|
| `GET /xrpc/com.jjalcloud.feed.getGif` | Single GIF |
| `GET /xrpc/com.jjalcloud.feed.getGifs` | GIF list |
| `GET /xrpc/com.jjalcloud.feed.searchGifs` | Search |
| `GET /xrpc/com.jjalcloud.feed.getFeed` | Feed |
| `GET /xrpc/com.jjalcloud.feed.getTrending` | Trending |

## Lexicons

- `com.jjalcloud.feed.gif` — GIF record (blob, title, alt, tags, dimensions)
- `com.jjalcloud.feed.like` — Like (strongRef)
- `com.jjalcloud.feed.defs` — View definitions
- `com.jjalcloud.graph.follow` — Follow

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `R2_ENDPOINT` | S3-compatible endpoint | — |
| `R2_ACCESS_KEY_ID` | S3 access key | — |
| `R2_SECRET_ACCESS_KEY` | S3 secret key | — |
| `R2_BUCKET` | S3 bucket name | — |
| `R2_PUBLIC_URL` | Public URL for bucket | — |
| `R2_REGION` | S3 region | `auto` |
| `OAUTH_CLIENT_ID` | AT Protocol OAuth client ID | — |
| `OAUTH_REDIRECT_URI` | OAuth callback URL | — |
| `OAUTH_PRIVATE_KEY` | JWK for private_key_jwt | — |
| `JETSTREAM_URLS` | Comma-separated Jetstream URLs | 4 default endpoints |
| `PUBLIC_URL` | Public site URL | `https://jjalcloud.com` |
| `PORT` | Server port | `3000` |
