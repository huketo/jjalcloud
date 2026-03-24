# jjalcloud v2 Frontend Migration: HonoX

## Overview

jjalcloud v2의 프론트엔드를 HonoX 기반으로 재구축한다. v1→v2 마이그레이션 과정에서 프론트엔드 코드가 제거되었고, 현재 최소한의 Hono SSR만 남아있는 상태를 정리하고 새로운 프론트엔드 토대를 만든다.

## Goals

- 코드베이스 정리 (v1 잔재 제거, 불필요한 설정 정리)
- HonoX 파일 기반 라우팅으로 전환
- Islands 아키텍처: SSR 기본 + 인터랙션 부분만 client hydration
- Tailwind CSS 스타일링
- 프론트엔드 구조 세팅 + 보일러플레이트까지 (페이지 구현은 별도)

## Decisions

| 항목 | 결정 | 이유 |
|------|------|------|
| 프레임워크 | HonoX | 파일 기반 라우팅, Islands 아키텍처, Hono 생태계 통합 |
| 렌더링 | 하이브리드 (SSR + Islands) | 공개 페이지 SEO/OG 임베드 + 관리 기능 인터랙션 |
| 스타일링 | Tailwind CSS | Vite 플러그인 빌트인 지원, 빠른 개발 |
| 빌드 도구 | Vite | HonoX 필수 의존, 런타임은 Bun |
| 렌더러 | React (`@hono/react-renderer`) | Islands에서 React hooks 사용 |

## Cleanup

### 제거

- `package.json`의 `workspaces` 설정 — `apps/`, `packages/` 디렉토리 없음
- `src/routes/web/` — HonoX `app/routes/`로 대체
- `.gitmodules` — 빈 파일

### 이동

- `src/` → `app/` (HonoX 구조)
  - `src/db/` → `app/db/`
  - `src/lib/` → `app/lib/`
  - `src/auth/` → `app/auth/`
  - `src/indexer/` → `app/indexer/`
  - `src/lexicon/` → `app/lexicon/`
  - `src/env.ts` → `app/env.ts`
  - `src/routes/api/` → `app/routes/api/`
  - `src/routes/tenor/` → `app/routes/v2/` (index.ts, search.ts, featured.ts, posts.ts, test-preload.ts, tenor.test.ts 모두 이동)
  - `src/routes/xrpc/` → `app/routes/xrpc/`
  - `src/routes/oauth/` → `app/routes/oauth/`
  - `src/server.ts` → `app/server.ts` (createApp()으로 재작성)
  - 테스트 파일 (`*.test.ts`)의 import 경로를 `src/` → `app/` 구조에 맞게 업데이트

### 수정

- `CLAUDE.md` — Vite 사용 허용 (HonoX 빌드 도구)
- `package.json` — 의존성 추가, scripts 업데이트
- `tsconfig.json` — `jsxImportSource`를 `hono/jsx` → `react`로 변경, `include`에 `app` 추가

## Project Structure

```
app/
  server.ts                       ← createApp() + 미들웨어
  client.ts                       ← islands hydration 진입점
  style.css                       ← @import 'tailwindcss'
  env.ts                          ← Zod 환경변수 검증
  global.d.ts                     ← @hono/react-renderer 타입

  routes/
    _renderer.tsx                 ← 공통 레이아웃 (OG, Tailwind, head)
    _middleware.ts                ← logger, cors
    _error.tsx                    ← 에러 페이지
    index.tsx                     ← / 홈 피드
    search.tsx                    ← /search
    upload.tsx                    ← /upload (인증 필요)
    gifs/[cid].tsx                ← /gifs/:cid GIF 상세
    profile/[identifier].tsx      ← /profile/:identifier (DID 또는 핸들)
    v2/index.ts                   ← Tenor API v2 (Hono 인스턴스 export)
    xrpc/index.ts                 ← AT Protocol XRPC
    oauth/index.ts                ← OAuth 로그인/콜백
    api/index.ts                  ← 내부 API (피드, 좋아요, 업로드)

  islands/                        ← 클라이언트 hydration 컴포넌트
    search-bar.tsx
    like-button.tsx
    upload-form.tsx
    gif-grid.tsx                  ← 무한 스크롤 피드

  db/
    client.ts                     ← Drizzle ORM + bun:sql
    schema.ts                     ← PostgreSQL 테이블 정의
  lib/
    r2.ts                         ← R2/Garage S3 클라이언트
    search.ts                     ← 전문 검색 쿼리
    tenor-adapter.ts              ← Tenor API 응답 변환
    identity.ts                   ← AT Protocol DID 해석
  auth/
    client.ts                     ← OAuth 클라이언트
    session-store.ts
    state-store.ts
  indexer/
    jetstream.ts                  ← Bluesky Jetstream 소비자
    handlers.ts                   ← 레코드 핸들러
    media.ts                      ← GIF→비디오 변환
  lexicon/                        ← 생성된 AT Protocol 타입

vite.config.ts
biome.json
tsconfig.json
```

## Routes

| URL | 파일 | 설명 |
|-----|------|------|
| `/` | `routes/index.tsx` | 홈 피드 (SSR) |
| `/search` | `routes/search.tsx` | 검색 (SSR + search-bar island) |
| `/upload` | `routes/upload.tsx` | 업로드 (인증 필요, upload-form island) |
| `/gifs/:cid` | `routes/gifs/[cid].tsx` | GIF 상세 (SSR + like-button island) |
| `/profile/:identifier` | `routes/profile/[identifier].tsx` | 프로필 (SSR + 본인이면 관리 탭) |
| `/oauth/*` | `routes/oauth/index.ts` | OAuth 로그인/콜백 |
| `/v2/*` | `routes/v2/index.ts` | Tenor API v2 호환 |
| `/xrpc/*` | `routes/xrpc/index.ts` | AT Protocol |
| `/api/*` | `routes/api/index.ts` | 내부 JSON API |

## Profile Identifier Resolution

`/profile/:identifier`에서 `identifier`를 다음과 같이 판별:

- `did:`로 시작 → DID로 직접 조회 (`did:plc:...`, `did:web:...`)
- 그 외 → 핸들로 간주, identity resolver를 통해 DID로 resolve

본인 프로필 접근 시 (세션의 DID와 일치) 관리 탭(내 짤, 좋아요)을 islands로 렌더링.

## Build & Dev

### vite.config.ts

```ts
import { defineConfig } from 'vite'
import honox from 'honox/vite'
import build from '@hono/vite-build/bun'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      build: {
        rollupOptions: {
          input: ['./app/client.ts'],
          output: {
            entryFileNames: 'static/client.js',
            chunkFileNames: 'static/assets/[name]-[hash].js',
            assetFileNames: 'static/assets/[name].[ext]',
          },
        },
        emptyOutDir: false,
      },
    }
  }
  return {
    plugins: [
      honox({ client: { input: ['/app/style.css'] } }),
      build(),
      tailwindcss(),
    ],
  }
})
```

### package.json scripts

```json
{
  "dev": "vite dev",
  "build": "vite build --mode client && vite build",
  "serve": "bun run dist/index.js",
  "format": "bunx biome format --write .",
  "lint": "bunx biome lint .",
  "check": "bunx biome check --write .",
  "typecheck": "bunx tsc --noEmit",
  "test": "bun test",
  "codegen": "bunx @atcute/lex-cli generate",
  "db:generate": "bunx drizzle-kit generate",
  "db:migrate": "bunx drizzle-kit migrate"
}
```

### Dependencies to Add

```
honox
@hono/react-renderer
@hono/vite-build
react
react-dom
@types/react
@types/react-dom
vite
@tailwindcss/vite
tailwindcss
```

## Server Entry

```ts
// app/server.ts
import { createApp } from 'honox/server'

const app = createApp()

export default app
```

HonoX가 `app/routes/`의 파일 라우팅을 자동으로 처리. API 라우트(`v2/`, `xrpc/`, `oauth/`, `api/`)는 각 파일에서 Hono 인스턴스를 export하는 방식으로 통합.

## Client Entry

```ts
// app/client.ts
import { createClient } from 'honox/client'

createClient({
  hydrate: async (elem, root) => {
    const { hydrateRoot } = await import('react-dom/client')
    hydrateRoot(root, elem)
  },
  createElement: async (type: any, props: any) => {
    const { createElement } = await import('react')
    return createElement(type, props)
  },
})
```

## Renderer

```tsx
// app/routes/_renderer.tsx
import { reactRenderer } from '@hono/react-renderer'

export default reactRenderer(({ children, title }) => {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {import.meta.env.PROD ? (
          <>
            <link rel="stylesheet" href="/static/assets/style.css" />
            <script type="module" src="/static/client.js" />
          </>
        ) : (
          <>
            <link rel="stylesheet" href="/app/style.css" />
            <script type="module" src="/app/client.ts" />
          </>
        )}
        {title ? <title>{title} - jjalcloud</title> : <title>jjalcloud</title>}
      </head>
      <body>{children}</body>
    </html>
  )
})
```

## CLAUDE.md Changes

Vite 관련 규칙 수정:
- ~~Don't use `vite`.~~ → HonoX 빌드 도구로 Vite 사용. 런타임은 Bun.
- `bun build` → `vite build`
- 개발 서버: `vite dev`

## Out of Scope

- 페이지 UI 구현 (홈, 검색, 상세, 프로필, 업로드의 실제 디자인)
- API 변경 (기존 API 라우트는 그대로 이동)
- 데이터베이스 스키마 변경
- 배포 설정 변경 (Dockerfile, Railway)
