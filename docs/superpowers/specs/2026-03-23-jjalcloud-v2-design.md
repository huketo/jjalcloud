# jjalcloud v2 Design Spec

## Overview

jjalcloud v2는 현재 Cloudflare Workers 기반 서버리스 아키텍처를 **Railway 기반 persistent Node.js(Bun) 서버**로 완전 재설계하는 프로젝트다. AT Protocol 기반 GIF 공유 플랫폼을 정식 AppView로 발전시키고, **Tenor API v2 전체 호환**을 통해 Tenor 서비스 종료에 따른 대체 서비스로 포지셔닝한다.

## Goals

1. Cloudflare Workers의 서버리스 한계 해소 (OAuth, persistent connection, direct DB access)
2. 정식 AT Protocol AppView 구현 (XRPC server, Jetstream indexer)
3. Tenor API v2 전체 호환 — 기존 Tenor 의존 서비스들의 무중단 전환 지원
4. 월 $7-13 수준의 저비용 운영

## Non-Goals

- 커스텀 피드 알고리즘
- Bluesky 호환 lexicon 전환 (커스텀 `com.jjalcloud.*` 유지)
- 이미지/영상 등 GIF 외 미디어 확장

## Architecture

### High-Level

```
Browser / Tenor Clients / XRPC Consumers
                    ↓
        ┌─── Cloudflare (Edge) ───┐
        │  DNS · CDN · R2 · Image │
        │       Resizing          │
        └────────┬────────────────┘
                 │ proxy_pass
        ┌────────▼────────────────┐
        │   Railway (Compute)     │
        │                         │
        │  ┌───────────────────┐  │
        │  │  Bun + Hono Server│  │
        │  │  ┌──────────────┐ │  │
        │  │  │ Web SSR      │ │  │
        │  │  │ Tenor API    │ │  │
        │  │  │ AppView XRPC │ │  │
        │  │  │ OAuth        │ │  │
        │  │  └──────────────┘ │  │
        │  │  ┌──────────────┐ │  │
        │  │  │ Jetstream    │ │  │
        │  │  │ Indexer      │ │  │
        │  │  └──────────────┘ │  │
        │  └───────┬───────────┘  │
        │          │              │
        │  ┌───────▼───────────┐  │
        │  │   PostgreSQL      │  │
        │  └───────────────────┘  │
        └─────────────────────────┘
                 │ outbound
        ┌────────▼────────────────┐
        │ Jetstream · User PDS    │
        └─────────────────────────┘
```

### Infrastructure

| Layer | Technology | Purpose |
|---|---|---|
| Edge | Cloudflare DNS + CDN | 도메인, 정적 자산 캐싱, DDoS 보호 |
| Edge | Cloudflare R2 | GIF 원본 + mp4/webm variant 캐시 저장 |
| Edge | Cloudflare Image Resizing | mediumgif/tinygif on-the-fly 리사이즈 |
| Compute | Railway (Bun runtime) | Unified server (SSR + API + AppView + Indexer) |
| Database | Railway PostgreSQL | 모든 데이터 (users, gifs, likes, tags, sessions 등) |

### Why Unified Server

v1은 web(Workers)과 indexer(Node.js)가 분리되어 D1 HTTP driver로 네트워크 홉이 필요했다. v2는 하나의 Bun 프로세스에 모든 것을 통합한다:

- Jetstream indexer가 PostgreSQL에 직접 쓰기 (네트워크 홉 제거)
- 코드 공유 자연스러움 (import, 타입)
- 단일 배포 단위 (Railway에서 관리 간편)
- 하나의 프로세스에서 WebSocket(Jetstream) 상시 유지 가능

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | Bun |
| Framework | Hono |
| SSR | Hono JSX |
| Database | PostgreSQL + Drizzle ORM |
| AT Protocol | atcute ecosystem (전체) |
| GIF Cache | Cloudflare R2 |
| GIF Resize | Cloudflare Image Resizing |
| Video Convert | ffmpeg (Bun subprocess) |
| Deploy | Railway (Dockerfile) |

### atcute Packages

| Package | Purpose |
|---|---|
| `@atcute/oauth-node-client` | 서버 OAuth (DPoP, PAR, PKCE, confidential client) |
| `@atcute/xrpc-server` | AppView XRPC 서버 (query, procedure, subscription) |
| `@atcute/jetstream` | Jetstream firehose 소비자 |
| `@atcute/lex-cli` | 커스텀 lexicon → TypeScript 코드젠 |
| `@atcute/client` | XRPC 클라이언트 (outbound PDS 호출) |
| `@atcute/identity-resolver-node` | DID/Handle 해석 |

## API Design

### Route Structure

```
/                          → Web SSR (Hono JSX)
/v2/search                 → Tenor compat: GIF 검색
/v2/featured               → Tenor compat: 인기 GIF
/v2/categories             → Tenor compat: 카테고리
/v2/autocomplete           → Tenor compat: 자동완성
/v2/search_suggestions     → Tenor compat: 연관 검색어
/v2/registershare          → Tenor compat: 공유 트래킹
/v2/posts                  → Tenor compat: GIF by ID
/xrpc/*                    → AT Protocol AppView (XRPC)
/oauth/*                   → AT Protocol OAuth flow
/api/*                     → Internal API (web frontend용)
```

### Tenor API Compatibility

Tenor API v2의 모든 엔드포인트를 호환한다. 핵심은 AT Protocol 레코드(`com.jjalcloud.feed.gif`)를 Tenor의 `GifObject` 포맷으로 변환하는 어댑터 레이어다.

**Tenor GifObject 응답 매핑:**

```typescript
// AT Protocol record → Tenor GifObject
{
  id: gif.rkey,
  title: gif.title,
  content_description: gif.alt,
  tags: gif.tags,
  media_formats: {
    gif:       { url: r2Url(gif, 'original'), dims: [w, h] },
    mediumgif: { url: cfResizeUrl(gif, 320),  dims: [320, h'] },
    tinygif:   { url: cfResizeUrl(gif, 220),  dims: [220, h'] },
    mp4:       { url: r2Url(gif, 'mp4'),      dims: [w, h] },
    tinymp4:   { url: r2Url(gif, 'tinymp4'),  dims: [320, h'] },
    webm:      { url: r2Url(gif, 'webm'),     dims: [w, h] }
  },
  created: gif.createdAt
}
```

- `gif` (원본): R2에 캐싱된 PDS blob URL
- `mediumgif`, `tinygif`: Cloudflare Image Resizing URL (`/cdn-cgi/image/width=N/`)
- `mp4`, `tinymp4`, `webm`: ffmpeg로 변환 후 R2에 캐싱 (lazy, 요청 시)

### AT Protocol AppView (XRPC)

`@atcute/xrpc-server`를 사용하여 커스텀 lexicon에 대한 XRPC 엔드포인트를 제공한다:

- `com.jjalcloud.feed.getGif` — 단일 GIF 조회
- `com.jjalcloud.feed.getGifs` — GIF 목록 조회 (cursor pagination)
- `com.jjalcloud.feed.searchGifs` — GIF 검색
- `com.jjalcloud.feed.getFeed` — 피드 (최신순)
- `com.jjalcloud.feed.getTrending` — 인기 GIF

## Data Model

### PostgreSQL Schema

```sql
-- 사용자 (OAuth 세션)
users (
  did         TEXT PRIMARY KEY,
  handle      TEXT NOT NULL,
  displayName TEXT,
  avatar      TEXT,
  createdAt   TIMESTAMPTZ DEFAULT NOW(),
  lastLoginAt TIMESTAMPTZ
)

-- GIF 메타데이터 (인덱싱)
gifs (
  uri           TEXT PRIMARY KEY,     -- at://did/com.jjalcloud.feed.gif/rkey
  cid           TEXT NOT NULL,
  author        TEXT NOT NULL REFERENCES users(did),
  rkey          TEXT NOT NULL,
  title         TEXT,
  alt           TEXT,
  width         INTEGER,
  height        INTEGER,
  blobRef       JSONB NOT NULL,       -- PDS blob reference
  createdAt     TIMESTAMPTZ NOT NULL,
  indexedAt     TIMESTAMPTZ DEFAULT NOW(),
  search_vector TSVECTOR,             -- full-text search
  UNIQUE(author, rkey)
)

-- 태그 (정규화, GIN 인덱스)
tags (
  id     SERIAL PRIMARY KEY,
  gif_uri TEXT NOT NULL REFERENCES gifs(uri) ON DELETE CASCADE,
  name   TEXT NOT NULL
)
CREATE INDEX idx_tags_name ON tags USING GIN (name gin_trgm_ops);

-- 좋아요
likes (
  id        SERIAL PRIMARY KEY,
  subject   TEXT NOT NULL,            -- GIF uri
  author    TEXT NOT NULL,
  rkey      TEXT NOT NULL,
  createdAt TIMESTAMPTZ NOT NULL,
  UNIQUE(author, rkey)
)

-- 카테고리 (Tenor API용)
categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  searchterm  TEXT NOT NULL,
  image_url   TEXT,
  position    INTEGER DEFAULT 0
)

-- 공유 이벤트 트래킹 (Tenor registershare, trending 계산용)
share_events (
  id        SERIAL PRIMARY KEY,
  gif_uri   TEXT NOT NULL REFERENCES gifs(uri) ON DELETE CASCADE,
  client_key TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW()
)

-- OAuth 세션 (@atcute/oauth-node-client용)
oauth_sessions (
  did        TEXT PRIMARY KEY,
  session    JSONB NOT NULL,
  updatedAt  TIMESTAMPTZ DEFAULT NOW()
)
```

### Search Strategy

- `gifs.search_vector`: PostgreSQL `tsvector`로 title, alt, tags를 인덱싱
- 한국어 검색: `pg_trgm` extension + trigram GIN index
- 자동완성: `tags.name`에 대한 prefix 검색 (LIKE 'prefix%' + GIN)
- 연관 검색어: 동일 GIF에 포함된 다른 태그 기반 추천

### Trending Algorithm

```sql
-- Materialized view, 주기적 갱신 (1시간)
CREATE MATERIALIZED VIEW trending_gifs AS
SELECT
  g.uri,
  COUNT(DISTINCT s.id) * 2 + COUNT(DISTINCT l.id) AS score
FROM gifs g
LEFT JOIN share_events s ON s.gif_uri = g.uri
  AND s.createdAt > NOW() - INTERVAL '24 hours'
LEFT JOIN likes l ON l.subject = g.uri
  AND l.createdAt > NOW() - INTERVAL '7 days'
GROUP BY g.uri
ORDER BY score DESC;
```

## Media Pipeline

### GIF Caching & Variant Generation

```
PDS blob (원본 GIF)
  ↓ Jetstream 인덱싱 시
  → R2에 원본 캐싱

Tenor API 요청 시:
  gif       → R2 원본 URL
  mediumgif → Cloudflare Image Resizing (width=320)
  tinygif   → Cloudflare Image Resizing (width=220)
  mp4       → 요청 시 ffmpeg 변환 → R2 캐싱 (lazy)
  tinymp4   → 요청 시 ffmpeg 변환 → R2 캐싱 (lazy)
  webm      → 요청 시 ffmpeg 변환 → R2 캐싱 (lazy)
```

**변환 전략: 하이브리드**
- GIF 리사이즈: Cloudflare Image Resizing (on-the-fly, 엣지 캐싱)
- 비디오 변환: ffmpeg on Railway (lazy, 첫 요청 시 변환 후 R2 캐싱)

## Project Structure

```
jjalcloud-v2/
├── src/
│   ├── server.ts              # Bun + Hono 엔트리포인트
│   ├── routes/
│   │   ├── web/               # SSR 페이지 (Hono JSX)
│   │   ├── tenor/             # Tenor API v2 호환 엔드포인트
│   │   ├── xrpc/              # AppView XRPC handlers
│   │   └── oauth/             # OAuth flow
│   ├── indexer/
│   │   ├── jetstream.ts       # @atcute/jetstream 기반
│   │   ├── media.ts           # R2 캐시 & ffmpeg 변환
│   │   └── batch.ts           # Batch writer
│   ├── db/
│   │   ├── schema.ts          # Drizzle + PostgreSQL
│   │   └── migrations/
│   ├── auth/
│   │   └── client.ts          # @atcute/oauth-node-client
│   ├── lexicons/              # com.jjalcloud.* 정의
│   └── lib/
│       ├── tenor-adapter.ts   # AT record → Tenor GifObject 변환
│       └── identity.ts        # @atcute/identity-resolver-node
├── drizzle.config.ts
├── Dockerfile                 # Railway 배포용
└── package.json
```

## Cost Estimate

| Item | Monthly Cost |
|---|---|
| Railway Bun Service | ~$5 |
| Railway PostgreSQL | ~$2-7 |
| Cloudflare DNS + CDN | $0 (free tier) |
| Cloudflare R2 | ~$0 (10GB free, 이후 $0.015/GB) |
| Cloudflare Image Resizing | ~$0-1 ($0.50/1K unique) |
| **Total** | **~$7-13/mo** |

## Migration from v1

v2는 완전 재설계이므로 v1 코드를 마이그레이션하지 않고 새로 작성한다. 단, 기존 데이터(D1)의 마이그레이션은 필요하다:

1. `wrangler d1 export --remote`로 D1 데이터 추출
2. SQLite → PostgreSQL 스키마 변환 (AUTOINCREMENT → SERIAL, etc.)
3. `pgloader` 또는 스크립트로 데이터 이전
4. Jetstream backfill로 누락 레코드 보충

### Cutover Plan

1. v2 Railway에 배포 및 검증
2. Jetstream indexer 가동, 데이터 동기화 확인
3. Cloudflare DNS를 Railway로 전환
4. v1 Workers 비활성화

## Lexicons

기존 `com.jjalcloud.*` 커스텀 lexicon을 유지한다:

- `com.jjalcloud.feed.gif` — GIF 레코드 (blob, title, alt, tags, dimensions)
- `com.jjalcloud.feed.like` — 좋아요
- `com.jjalcloud.feed.defs` — View 정의
- `com.jjalcloud.graph.follow` — 팔로우

`@atcute/lex-cli`를 사용하여 lexicon JSON에서 TypeScript 타입을 자동 생성한다.
