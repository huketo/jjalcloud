# jjalcloud (짤클라우드)

**jjalcloud**는 AT Protocol(ATProto)을 기반으로 한 탈중앙화 GIF 공유 및 아카이빙 플랫폼입니다.  
사용자는 자신의 PDS(Personal Data Server)에 미디어를 소유하며, **Bluesky OAuth**를 통해 간편하게 로그인하고 본인만의 짤 피드를 구축할 수 있습니다.

## Features

### 1단계: Infra & Auth (🚧 진행 중)
- [x] **Cloudflare Workers 환경 설정** (Wrangler, Hono)
- [x] **Cloudflare KV 설정** (DID_CACHE, HANDLE_CACHE, STATE_STORE, SESSION_STORE)
- [ ] **Cloudflare D1 설정** (메타데이터 저장용 SQLite)
- [x] **Bluesky OAuth 인증** 구현 (로그인, 콜백, 로그아웃)
- [x] **Stateless 세션 관리** 구현

### 2단계: Core Logic (🚧 진행 중)
- [x] **Lexicon 정의**: `com.jjalcloud.feed.gif`, `like`, `follow` 등 데이터 모델 설계
- [x] **Lexicon 타입 생성**: `lex-cli`를 이용한 TypeScript 타입 정의
- [x] **GIF 관리 API**:
  - [x] 내 GIF 목록 조회 (PDS `listRecords`)
  - [x] GIF 업로드 (Blob 업로드 및 레코드 생성)
  - [x] GIF 수정
  - [x] GIF 삭제
- [ ] **소셜 인터랙션 API**:
  - [ ] 좋아요 (Like)

### 3단계: Indexing & Real-time (❌ 예정)
- [ ] **Jetstream Indexer**: 전체 네트워크의 `jjalcloud` 레코드 수집/동기화 (Cron Worker)
- [ ] **Durable Objects**: 인덱싱 커서 관리 및 실시간 상태 동기화
- [ ] **Cloudflare D1 활용**: PDS 데이터의 전역 인덱싱 및 캐싱 레이어 (Read Model) 구축
- [ ] **Global Feed & Search**: D1 기반의 최신순 정렬, 태그 필터링, 검색 API 구현

### 4단계: Frontend (🚧 진행 중)
- [x] **Hono JSX Renderer**: 기본 레이아웃 및 SSR 설정
- [ ] **메인 피드**: 인덱싱된 GIF 무한 스크롤 및 피드 UI
- [ ] **상세 페이지 & 플레이어**: GIF 재생 및 메타데이터 표시

## Getting Started

### Prerequisites

- Node.js & pnpm
- Cloudflare Wrangler CLI

### Installation

```bash
pnpm install
```

### Development

Start the development server:

```bash
pnpm dev
```

### Deployment

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

### Type Generation

Synchronize types based on your Worker configuration:

```bash
pnpm cf-typegen
```

### Lexicon Generation

Generate TypeScript types from Lexicon definitions:

```bash
pnpm lexgen
```
