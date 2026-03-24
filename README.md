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

#### 1. HTTPS 설정 (portless)

AT Protocol OAuth는 기밀 클라이언트(confidential client)에 HTTPS를 요구합니다. [portless](https://github.com/vercel-labs/portless)를 사용해 로컬에서 HTTPS 개발 환경을 구성합니다.

```bash
# portless 설치 (글로벌)
bun install -g portless

# 프록시 시작 (최초 1회, HTTPS CA 자동 생성)
portless proxy start --https --tld dev

# 로컬 CA 시스템 신뢰 등록
sudo env PATH="$PATH" portless trust
```

OAuth 서명에 사용할 개인키를 생성합니다:

```bash
bun run scripts/gen-key.ts
```

출력된 JWK를 `.env`의 `OAUTH_PRIVATE_KEY`에 설정합니다:

```env
OAUTH_CLIENT_ID=https://jjalcloud.dev/oauth/client-metadata.json
OAUTH_REDIRECT_URI=https://jjalcloud.dev/oauth/callback
OAUTH_PRIVATE_KEY={"kty":"EC","crv":"P-256","x":"...","y":"...","d":"...","kid":"..."}
PUBLIC_URL=https://jjalcloud.dev
```

> **참고**: portless는 `PORT` 환경변수를 자동 주입하고, `https://jjalcloud.dev`로 리버스 프록시합니다. `--tld dev`를 사용하는 이유는 AT Protocol OAuth 라이브러리가 `localhost`, `test`, `local` 등의 TLD를 차단하기 때문입니다.

#### 2. 인프라 및 서버 시작

```bash
# 인프라 시작 (PostgreSQL, PDS, Garage)
docker compose up -d

# Garage S3 초기화 + .env, .env.test 자동 생성 (최초 1회)
bun run scripts/garage-init.ts

# .env의 OAUTH_PRIVATE_KEY에 생성한 키 설정
bun run scripts/gen-key.ts

# 개발 서버 시작 (portless 경유)
bun run dev
```

> `garage-init.ts`는 `.env`(개발용, DB: `jjalcloud`)와 `.env.test`(테스트용, DB: `jjalcloud_test`)를 자동 생성합니다. `.env`가 이미 존재하면 덮어쓰지 않습니다.

### Testing

테스트는 `.env.test`를 사용하며, 개발 DB(`jjalcloud`)와 분리된 테스트 DB(`jjalcloud_test`)에서 실행됩니다.

```bash
# 테스트 계정 시드 (최초 1회, Docker 필요)
bun run test:setup

# 단위 테스트
bun run test

# 통합 테스트 (Docker 필요)
bun run test:integration
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
