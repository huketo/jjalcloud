# Production Deployment Guide

jjalcloud v2를 Railway에 배포하고 프로덕션으로 전환하는 가이드.

## Prerequisites

- [Railway](https://railway.com) 계정
- [Cloudflare](https://cloudflare.com) 계정 (DNS, R2, Image Resizing)
- 도메인 (jjalcloud.com)
- AT Protocol OAuth 클라이언트 등록

## Step 1: Railway 프로젝트 설정

### 1.1 프로젝트 생성

1. Railway Dashboard → New Project
2. "Deploy from GitHub repo" 선택
3. `huketo/jjalcloud` 리포지토리 연결, `v2` 브랜치 선택
4. Builder: Dockerfile (자동 감지)

### 1.2 PostgreSQL 추가

1. 프로젝트 내 "New Service" → "Database" → "PostgreSQL"
2. 생성 후 `DATABASE_URL` 연결 문자열 복사
3. Railway가 자동으로 `DATABASE_URL` 환경변수를 서비스에 주입

### 1.3 환경변수 설정

Railway 서비스의 Variables 탭에서 설정:

```
# Database (Railway PostgreSQL 자동 주입)
DATABASE_URL=<railway-postgresql-url>

# Cloudflare R2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-api-token-key>
R2_SECRET_ACCESS_KEY=<r2-api-token-secret>
R2_BUCKET=jjalcloud-gifs
R2_PUBLIC_URL=https://cdn.jjalcloud.com

# OAuth
OAUTH_CLIENT_ID=https://jjalcloud.com/oauth/client-metadata.json
OAUTH_REDIRECT_URI=https://jjalcloud.com/oauth/callback
OAUTH_PRIVATE_KEY=<jwk-json>

# Public
PUBLIC_URL=https://jjalcloud.com
PORT=3000
```

`JETSTREAM_URLS`는 기본값(4개 엔드포인트)이 사용되므로 설정 불필요.

## Step 2: Cloudflare R2 설정

### 2.1 R2 Bucket 생성

```bash
wrangler r2 bucket create jjalcloud-gifs
```

### 2.2 R2 API Token 생성

1. Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. "Create API Token"
3. Permissions: Object Read & Write
4. Bucket: `jjalcloud-gifs`
5. Access Key ID와 Secret Access Key를 Railway 환경변수에 설정

### 2.3 R2 Custom Domain 설정 (CDN)

1. R2 bucket → Settings → Custom Domains
2. `cdn.jjalcloud.com` 추가
3. Cloudflare DNS에 자동으로 CNAME 레코드 생성

### 2.4 Image Resizing 활성화

1. Cloudflare Dashboard → Speed → Optimization → Image Resizing
2. 활성화 (Pro plan 이상 필요, 또는 Polish로 대체)
3. `cdn.jjalcloud.com/cdn-cgi/image/...` URL 패턴이 동작하는지 확인

## Step 3: OAuth 키 생성

AT Protocol OAuth에 사용할 ES256 JWK 키를 생성합니다.

```bash
# ES256 키페어 생성 (Node.js)
node -e "
const { generateKeyPairSync } = require('crypto');
const { privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});
const jwk = privateKey.export({ format: 'jwk' });
console.log(JSON.stringify(jwk));
"
```

출력된 JWK JSON을 `OAUTH_PRIVATE_KEY` 환경변수에 설정합니다.

## Step 4: 데이터베이스 초기화

Railway PostgreSQL에 마이그레이션을 적용합니다.

```bash
# Railway CLI로 환경변수를 가져와서 실행
DATABASE_URL=<railway-pg-url> bunx drizzle-kit migrate
```

또는 Railway 서비스가 처음 시작될 때 수동으로 마이그레이션을 실행합니다.

search_setup.sql (tsvector trigger, pg_trgm, trending view)도 적용합니다:

```bash
psql <railway-pg-url> -f src/db/migrations/0001_search_setup.sql
```

## Step 5: 데이터 마이그레이션 (v1 → v2)

v1 데이터가 있는 경우, [Migration Guide](./migration-guide.md)를 참고하여 D1 데이터를 PostgreSQL로 마이그레이션합니다.

```bash
# D1 데이터 export
npx wrangler d1 export jjalcloud_db --remote --output=d1-export.sql

# Dry run
DATABASE_URL=<railway-pg-url> bun run scripts/migrate-d1.ts --dry-run

# 실행
DATABASE_URL=<railway-pg-url> bun run scripts/migrate-d1.ts
```

## Step 6: 배포 확인

Railway가 Dockerfile 기반으로 자동 배포합니다. 배포 후 확인:

```bash
# Health check
curl https://<railway-app>.up.railway.app/health
# Expected: {"ok":true}

# Tenor API 확인
curl https://<railway-app>.up.railway.app/v2/featured?limit=1

# XRPC 확인
curl https://<railway-app>.up.railway.app/xrpc/com.jjalcloud.feed.getFeed?limit=1
```

Railway 로그에서 확인할 항목:
- `[server] jjalcloud v2 running on port 3000`
- `[indexer] Connecting to Jetstream: wss://jetstream1.us-east.bsky.network/subscribe`

## Step 7: DNS 전환

v2가 정상 동작하는 것을 확인한 후, DNS를 전환합니다.

### 7.1 Railway Custom Domain 설정

1. Railway 서비스 → Settings → Networking → Custom Domain
2. `jjalcloud.com` 추가
3. Railway가 제공하는 CNAME 값 복사

### 7.2 Cloudflare DNS 업데이트

1. Cloudflare Dashboard → DNS
2. 기존 `jjalcloud.com` A/CNAME 레코드를 Railway CNAME으로 변경
3. Proxy status: Proxied (주황색 구름) 활성화
4. SSL/TLS: Full (strict)

### 7.3 DNS 전파 확인

```bash
# DNS 확인
dig jjalcloud.com

# 실제 요청 확인
curl -I https://jjalcloud.com/health
```

## Step 8: v1 비활성화

DNS 전환 후 트래픽이 v2로 정상 흐르는 것을 확인하면:

1. Cloudflare Dashboard → Workers & Pages
2. jjalcloud Worker의 Route 비활성화
3. 즉시 삭제하지 말고 며칠간 유지 (롤백 대비)

## Rollback Plan

문제 발생 시:

1. Cloudflare DNS를 원래 v1 Workers Route로 복구
2. v1 Workers를 다시 활성화
3. Railway 서비스는 유지 (문제 진단용)

DNS 전환은 몇 분 내로 반영되므로 빠르게 롤백 가능합니다.

## Post-Deployment Checklist

- [ ] Health check 통과 (`/health`)
- [ ] Jetstream indexer 연결 확인 (로그)
- [ ] OAuth 로그인 동작 확인
- [ ] GIF 업로드 → 인덱싱 → 검색 확인
- [ ] Tenor API 응답 형식 확인
- [ ] R2 GIF 캐싱 동작 확인
- [ ] Image Resizing URL 동작 확인
- [ ] 좋아요/공유 → trending 반영 확인
- [ ] SSL 인증서 유효 확인
- [ ] v1 Workers 비활성화 완료

## Cost Overview

| Item | Monthly Cost |
|---|---|
| Railway Bun Service | ~$5 |
| Railway PostgreSQL | ~$2-7 |
| Cloudflare DNS + CDN | $0 (free tier) |
| Cloudflare R2 | ~$0 (10GB free) |
| Cloudflare Image Resizing | ~$0-1 |
| **Total** | **~$7-13/mo** |
