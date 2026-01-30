# PRD

# jjalcloud (짤클라우드) PRD

## 1. 프로젝트 개요

**jjalcloud** 는 AT Protocol(ATProto)을 기반으로 한 탈중앙화 GIF 공유 및 아카이빙 플랫폼입니다. 사용자는 자신의 PDS(Personal Data Server)에 미디어를 소유하며, **Bluesky OAuth** 를 통해 간편하게 로그인하고 본인만의 짤 피드를 구축할 수 있습니다.

### 1.1. 배경 및 목적

* **데이터 주권 확보:** 중앙 서버가 아닌 사용자의 PDS에 직접 GIF 파일을 저장하여 데이터 소유권을 사용자에게 반환합니다.
* **인증의 편의성:** 별도의 가입 절차 없이 기존 블루스카이 계정(DID)으로 로그인하는 **OAuth** 체계 활용.
* **기술적 도전:** ATProto의 Custom Lexicon 정의, 외부 서비스 통합을 위한 **Public API** 레이어 구축, 대규모 미디어 인덱싱.

## 2. 사용자 기능 요구사항 (Functional Requirements)

### 2.1. 인증 및 계정 (Identity)

* **Bluesky OAuth 로그인:** 사용자는 본인의 Bluesky/DID 계정으로 인증합니다.
* **Worker 기반 Auth 핸들러:** **Hono** 기반의 Cloudflare Worker가 OAuth 인증 흐름을 처리하며, 세션 및 토큰 관리는 **Cloudflare KV** 또는 암호화된 쿠키를 활용하여 Stateless하게 처리합니다.

### 2.2. 미디어 관리 (Media Management)

* **Gifs 업로드 (우선 구현):** 이미 완성된 GIF 파일을 업로드하는 기능에 집중합니다.
* **입력 항목:** 제목, **GIF 파일(Blob)**, 태그를 입력하여 본인의 PDS에 직접 저장합니다.
* **Media 확장 (추후 구현):** 현재는 **Gifs** 만 지원하지만, 향후 **Stickers** (배경 투명 GIF/PNG) 및 **Clips** (짧은 루핑 비디오)를 추가할 예정입니다.
* **조회 및 검색:** 제목과 태그를 기반으로 미디어를 검색하고 상세 메타데이터를 확인합니다.
* **수정/삭제:** 업로드된 정보를 수정하거나 PDS에서 레코드를 삭제하여 즉시 반영합니다.

### 2.3. 소셜 인터랙션 (Social Interaction)

* **좋아요 (Like):** 마음에 드는 콘텐츠에 긍정적인 반응을 남깁니다.

### 2.4. 외부 통합 (Integration - Giphy Style)

* **공용 Search API:** 외부 앱(메신저, 블로그 도구 등)에서 **jjalcloud** 의 GIF를 검색하고 가져갈 수 있도록 Stateless API를 제공합니다.
* **Embed SDK (추후):** 다른 웹사이트에 미디어를 쉽게 임베드할 수 있는 스크립트 기반 기능을 염두에 둡니다.

## 3. 기술 스택 및 아키텍처

```mermaidjs
graph TD
    %% 사용자 및 프론트엔드
    User["Users / Clients"] -->|HTTPS| Worker["Cloudflare Workers (Hono SSR & API)"]
    User -->|WebSocket| DO["Durable Objects (Real-time)"]
    
    %% 백엔드 API (Hono)
    Worker -->|"Meta Data"| D1[("Cloudflare D1 (SQLite)")]
    Worker -->|"Session/Cache"| KV[("Cloudflare KV")]
    
    %% 인덱서 (Scheduled Worker)
    Cron["Cron Trigger (Every 1 min)"] -->|Wake up| Indexer["Indexer Worker"]
    Indexer -->|"Fetch via Jetstream"| Jetstream["ATProto Jetstream"]
    Indexer -->|"Sync Meta"| D1
    Indexer -->|"Update Cursor & Broadcast"| DO
    
    %% 스토리지 (PDS)
    Worker -->|"Upload Blob"| PDS["User's PDS"]
```

### 3.1. 기술 스택

* **언어:** TypeScript (Frontend/Backend 통일)
* **프론트엔드/백엔드:** **Cloudflare Workers** (**Hono** 프레임워크 기반 SSR 및 API)
* **데이터베이스 (Read Layer):** **Cloudflare D1** (SQLite) + **Drizzle ORM**. Type-safe한 쿼리 작성 및 스키마 관리를 위해 **Drizzle ORM**을 사용합니다. PDS에 흩어진 데이터의 메타데이터를 모아 인덱싱하여 전역 피드 조회, 태그 검색, 정렬 기능을 제공하는 **조회 전용 저장소**입니다.
* **상태 관리 및 실시간성:** **Cloudflare Durable Objects** (인덱싱 커서 관리 및 WebSocket 브로드캐스트)
* **캐시 및 세션:** **Cloudflare KV** (DID 캐시 및 세션 저장)
* **스토리지:** **AT Protocol PDS** (GIF Blob 저장)
* **프로토콜:** AT Protocol (`@atproto/api`)

### 3.2. 시스템 구조

* **Hono on Workers (SSR & API):** 단일 코드베이스에서 UI 렌더링(JSX)과 API 로직을 처리하여 초기 로딩 속도와 개발 효율성을 극대화합니다.
* **Durable Objects (Coordinator):** Jetstream 인덱싱을 위한 마지막 커서(Cursor)를 유지하며, 연결된 클라이언트들에게 실시간 업데이트를 전달합니다.
* **Scheduled Indexer (Cron Worker):** 1분 주기로 실행되어 Jetstream에서 새로운 `com.jjalcloud.gifs` 레코드를 폴링하고 D1 데이터베이스와 동기화합니다.
* **Indexing Strategy (Write/Read Separation):** 원본 데이터는 **PDS**에 저장(Write)하고, 이를 **Jetstream** 등을 통해 감지하여 **D1**에 메타데이터를 인덱싱(Sync)합니다. 클라이언트는 조회 시 **D1**을 쿼리하여 빠른 응답 속도와 전역 검색 기능을 활용합니다.
* **PDS Storage Strategy:** GIF 파일을 외부 스토리지에 미러링하지 않고 사용자의 PDS에 Blob으로 업로드하여 데이터 주권을 유지하고 스토리지 비용을 제거합니다.

## 4. 데이터 모델 (Lexicon 설계)

| 종류            | Lexicon ID             | 설명                                          |
| --------------- | ---------------------- | --------------------------------------------- |
| **Gifs 레코드** | `com.jjalcloud.gifs`   | `title` , `file(blob)` , `tags` , `createdAt` |
| **좋아요**      | `com.jjalcloud.like`   | `subject(strongRef)` , `createdAt`            |
| **팔로우**      | `com.jjalcloud.follow` | `subject(did)` , `createdAt`                  |

## 5. UI/UX 디자인 가이드

### 5.1. 레이아웃 및 스타일
* **Masonry Layout:** 다양한 비율(가로형/세로형)의 GIF가 자연스럽게 배치되도록 Pinterest 스타일의 메이슨리 그리드 시스템을 메인 피드에 적용합니다.
* **Minimalistic Theme:** 콘텐츠(GIF) 자체에 집중할 수 있도록 흑백 위주의 미니멀한 UI를 지향하며, 다크 모드를 기본으로 지원합니다.
* **Auto-Play with Placeholder:** 피드 스크롤 시 화면 중앙에 위치한 GIF는 자동 재생되며, 로딩 중에는 사이트 테마의 랜덤 색상 이미지를 플레이스홀더로 표시합니다.

### 5.2. 인터랙션
* **Micro-Interactions:** 좋아요 클릭 시 하트 애니메이션, 복사 성공 시 토스트 메시지 등 즉각적인 피드백을 제공합니다.
* **Infinite Scroll:** 페이지네이션 대신 무한 스크롤을 적용하여 끊김 없는 탐색 경험을 제공합니다.

### 5.3. 사이트맵 (Sitemap)

* **Home (`/`)**: 메인 피드 (전체/팔로잉 탭), 검색창, 로그인/로그아웃 버튼
* **Profile (`/profile/:did`)**: 유저 프로필 정보, 업로드한 GIF 목록, 좋아요한 GIF 목록 (Grid View)
* **Detail (`/gif/:rkey`)**: GIF 상세 보기, 메타데이터(제목, 태그, 작성자), 좋아요 버튼, 공유 링크
* **Upload (`/upload`)**: GIF 파일 업로드 및 메타데이터 입력 폼 (로그인 필요)
* **Auth (`/oauth/*`)**: OAuth 로그인 리다이렉션 처리 페이지

## 6. 개발 로드맵


1. **1단계 (Infra & Auth):**

* Cloudflare(Workers, D1, KV, Durable Objects) 환경 설정 (`wrangler.jsonc`) 및 **Drizzle ORM** 설정.
* **Hono** 기반의 **Bluesky OAuth** 인증 및 Stateless 세션 관리 구현.


2. **2단계 (Core Logic):**

* Lexicon 정의 및 `com.jjalcloud.gifs` 레코드 생성 로직 구현.
* GIF 파일을 PDS에 직접 업로드하고 D1에 메타데이터를 기록하는 파이프라인 구축.


3. **3단계 (Indexing & Real-time):**

* **Durable Objects**를 이용한 인덱싱 커서(Cursor) 저장소 구현.
* **Cron Trigger** 기반의 Jetstream 배치 인덱서 및 실시간 WebSocket 브로드캐스트 구현.


4. **4단계 (Frontend):**

* Hono JSX를 활용한 SSR 기반 메인 피드 및 상세 페이지 구현.
* 무한 스크롤 및 실시간 업데이트 연동.


5. **5단계 (Optimization):**

* Cloudflare KV를 활용한 DID 및 프로필 데이터 캐싱 최적화.
* 외부 공유를 위한 동적 메타 태그(OG Image) 생성 기능 추가.


6. **6단계 (Extension):**

* 타사 앱 연동을 위한 Public API 문서화 (OpenAPI via Hono).