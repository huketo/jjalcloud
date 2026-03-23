# Local Development & Integration Tests Design Spec

## Overview

jjalcloud v2의 로컬 개발 환경을 Docker Compose로 구성하고, 실제 PostgreSQL + PDS + S3 호환 스토리지(Garage)를 사용하는 통합 테스트를 구현한다. Wrangler CLI로 R2 bucket 관리 및 배포를 지원한다.

## Goals

1. `docker compose up` 한 번으로 전체 로컬 개발 환경 구동
2. 실제 인프라 기반 통합 테스트로 전체 플로우 검증
3. Wrangler 기반 R2 관리 및 배포 파이프라인

## Non-Goals

- Playwright e2e 테스트 (별도 단계)
- CI/CD 파이프라인 구성 (별도 단계)

## Docker Compose Architecture

```
docker-compose.yml
├── postgres (PostgreSQL 18-alpine)
│   port: 5432
│   DB: jjalcloud_test
│   migrations: 자동 적용 (init script)
│
├── pds (ghcr.io/bluesky-social/pds:0.4)
│   port: 2583
│   SQLite backend (devMode)
│   테스트 계정 자동 생성
│
└── garage (dxflrs/garage)
    port: 3900 (S3 API)
    port: 3902 (admin API)
    jjalcloud-gifs bucket 자동 생성
```

### PostgreSQL 18

- Image: `postgres:18-alpine`
- DB 초기화: Drizzle migration + `0001_search_setup.sql` (tsvector trigger, pg_trgm, trending view)
- Volume: `pgdata` for persistence between restarts
- Healthcheck: `pg_isready`

### PDS (AT Protocol Personal Data Server)

atproto dev-env 패턴을 참고한 최소 설정:

```
PDS_DEV_MODE=true
PDS_PORT=2583
PDS_HOSTNAME=localhost
PDS_DATA_DIRECTORY=/pds/data
PDS_BLOBSTORE_DISK_LOCATION=/pds/blocks
PDS_ADMIN_PASSWORD=admin-pass
PDS_JWT_SECRET=jwt-secret
PDS_SERVICE_HANDLE_DOMAINS=.test
PDS_INVITE_REQUIRED=false
PDS_DISABLE_SSRF_PROTECTION=true
PDS_DID_PLC_URL=https://plc.directory
PDS_BSKY_APP_VIEW_URL=https://api.bsky.app
PDS_BSKY_APP_VIEW_DID=did:web:api.bsky.app
PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=<generated>
```

- Healthcheck: HTTP GET `/xrpc/_health`
- 테스트 계정 seed: `alice.test`, `bob.test` (setup 스크립트에서 `com.atproto.server.createAccount` 호출)

### Garage (S3-compatible Storage)

- Image: `dxflrs/garage`
- S3 API port: 3900
- Admin API port: 3902
- 초기화: `scripts/garage-init.sh` — layout 설정, API key 생성, `jjalcloud-gifs` bucket 생성
- S3 endpoint: `http://localhost:3900`
- 초기화 스크립트는 Garage admin API (`localhost:3902`)를 사용하여 자동 설정

## Wrangler Configuration

```toml
# wrangler.toml
name = "jjalcloud"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "GIFS_BUCKET"
bucket_name = "jjalcloud-gifs"

[env.production]
r2_buckets = [
  { binding = "GIFS_BUCKET", bucket_name = "jjalcloud-gifs" }
]
```

Wrangler 역할:
- `wrangler r2 bucket create jjalcloud-gifs` — 프로덕션 R2 bucket 생성
- `wrangler r2 object put/get/delete` — R2 데이터 관리
- 향후 CDN/Image Resizing 설정 관리
- 배포 관련 설정 관리

## Integration Test Architecture

### 파일 구조

```
tests/
├── setup.ts              # 환경 연결 확인, 테스트 계정 seed, bucket 확인
├── teardown.ts           # DB 정리, 테스트 데이터 삭제
├── helpers/
│   ├── pds.ts            # PDS 계정 생성, 레코드 작성 헬퍼
│   ├── db.ts             # 테스트 DB 클라이언트
│   └── s3.ts             # Garage S3 클라이언트
├── integration/
│   ├── oauth.test.ts     # OAuth 로그인 플로우
│   ├── gif-lifecycle.test.ts  # 업로드 → 인덱싱 → 검색 → 조회
│   ├── like-trending.test.ts  # 좋아요 → 공유 → trending 반영
│   ├── media.test.ts     # Garage 캐싱, Image Resize URL 생성
│   ├── tenor-api.test.ts # Tenor API 전체 엔드포인트 (실제 DB)
│   └── xrpc.test.ts      # XRPC 쿼리 (실제 DB)
```

### 테스트 실행 흐름

1. `docker compose up -d` — 인프라 시작
2. `bun run test:setup` — DB migration, PDS 테스트 계정 생성, Garage bucket 확인
3. `bun run test:integration` — 통합 테스트 실행
4. `docker compose down` — 정리

### 환경 변수 (.env.test)

```
DATABASE_URL=postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test
R2_ENDPOINT=http://localhost:3900
R2_ACCESS_KEY_ID=<garage-key>
R2_SECRET_ACCESS_KEY=<garage-secret>
R2_BUCKET=jjalcloud-gifs
R2_PUBLIC_URL=http://localhost:3900/jjalcloud-gifs
PDS_URL=http://localhost:2583
OAUTH_CLIENT_ID=http://localhost:3000
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
OAUTH_PRIVATE_KEY=<test-jwk>
PUBLIC_URL=http://localhost:3000
JETSTREAM_URLS=wss://jetstream1.us-east.bsky.network/subscribe,wss://jetstream2.us-east.bsky.network/subscribe
```

Note: `JETSTREAM_URL`은 env 스키마 검증을 위해 필요하나, 통합 테스트에서 Jetstream 연결은 시작하지 않는다. 테스트 서버는 Jetstream 없이 HTTP 라우트만 실행한다.

### 테스트 플로우 상세

#### oauth.test.ts
- PDS에 테스트 계정 로그인
- OAuth authorize → callback 플로우
- 세션 쿠키 발급 확인
- users 테이블에 DID/handle 저장 확인

#### gif-lifecycle.test.ts

통합 테스트에서 Jetstream은 사용하지 않는다. 로컬 PDS는 공용 Jetstream relay에 이벤트를 발행하지 않기 때문이다. 대신 indexer handlers (`handleGifCreate`, `handleGifDelete`)를 직접 호출하여 인덱싱을 시뮬레이션한다.

- PDS에 GIF blob 업로드 (`com.atproto.repo.uploadBlob`)
- PDS에 `com.jjalcloud.feed.gif` 레코드 생성 (`com.atproto.repo.createRecord`)
- `handleGifCreate(db, uri, cid, author, rkey, record)` 직접 호출 (Jetstream 시뮬레이션)
- PostgreSQL gifs/tags 테이블에 데이터 존재 확인
- Tenor `/v2/search` 결과에 포함 확인
- XRPC `getGif` 응답 확인
- `handleGifDelete(db, uri)` 호출 → 인덱스 제거 확인

#### like-trending.test.ts

좋아요도 동일하게 handlers를 직접 호출한다.

- `handleLikeCreate(db, author, rkey, record)` 호출
- `/v2/registershare` 공유 이벤트 등록 (HTTP 호출)
- trending materialized view 갱신 (REFRESH 직접 실행)
- `/v2/featured` 결과에 반영 확인
- `handleLikeDelete(db, author, rkey)` 호출 → likeCount 감소 확인

#### media.test.ts
- PDS blob → Garage(R2) 캐싱 확인
- `r2Key` 형식으로 저장 확인
- `cfResizeUrl` URL 형식 검증
- 비디오 변환 엔드포인트 (`/media/:author/:rkey/:variant`) 호출

#### tenor-api.test.ts
- `/v2/search?q=...` — 실제 DB 검색 결과
- `/v2/featured` — trending 기반 결과
- `/v2/categories` — 카테고리 목록
- `/v2/autocomplete?q=...` — 태그 자동완성
- `/v2/search_suggestions?q=...` — 연관 검색어
- `/v2/posts?ids=...` — ID 기반 조회
- 응답 형식이 Tenor API v2 스펙과 일치하는지 검증

#### xrpc.test.ts
- `com.jjalcloud.feed.getGif` — 단일 조회 + likeCount
- `com.jjalcloud.feed.getGifs` — 목록 + cursor pagination
- `com.jjalcloud.feed.searchGifs` — 검색 + cursor
- `com.jjalcloud.feed.getFeed` — 피드
- `com.jjalcloud.feed.getTrending` — 인기 목록

### 기존 테스트와 분리

| | 단위/라우트 테스트 (`src/`) | 통합 테스트 (`tests/`) |
|---|---|---|
| 실행 | `bun test src/` | `bun test:integration` |
| 의존성 | 없음 (mock) | Docker Compose |
| 속도 | ~400ms | ~수 초 |
| 목적 | 로직 정확성 | 인프라 연동 |

## Scripts (package.json)

```json
{
  "dev": "bun run --hot src/server.ts",
  "dev:infra": "docker compose up -d",
  "dev:seed": "bun run tests/setup.ts",
  "test": "bun test src/",
  "test:integration": "bun test tests/integration/",
  "test:setup": "bun run tests/setup.ts",
  "deploy:r2": "wrangler r2 bucket create jjalcloud-gifs",
  "db:generate": "bunx drizzle-kit generate",
  "db:migrate": "bunx drizzle-kit migrate"
}
```
