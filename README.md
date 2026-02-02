# jjalcloud

**jjalcloud** is a decentralized GIF sharing and archiving platform based on the AT Protocol (ATProto).
Users own their media on their PDS (Personal Data Server), can easily log in via **Bluesky OAuth**, and build their own GIF feed.

## Features

### Phase 1: Infra & Auth (✅ Completed)
- [x] **Cloudflare Workers Setup** (Wrangler, Hono)
- [x] **Cloudflare KV Setup** (DID_CACHE, HANDLE_CACHE, STATE_STORE, SESSION_STORE)
- [x] **Cloudflare D1 Setup** (SQLite for metadata storage)
- [x] **Bluesky OAuth Authentication** (Login, Callback, Logout)
- [x] **Stateless Session Management**

### Phase 2: Core Logic (✅ Completed)
- [x] **Lexicon Definitions**: Data model design for `com.jjalcloud.feed.gif`, `like`, `follow`, etc.
- [x] **Lexicon Type Generation**: TypeScript type definitions using `lex-cli`
- [x] **GIF Management API**:
  - [x] List my GIFs (PDS `listRecords`)
  - [x] GIF Upload (Blob upload and record creation)
  - [x] GIF Edit
  - [x] GIF Delete
- [x] **Social Interaction API**:
  - [x] Like

### Phase 3: Indexing & Real-time (❌ Planned)
- [ ] **Monorepo Structure**: Separate `apps/web` (Cloudflare Workers) and `apps/indexer` (Node.js) using pnpm workspace
- [ ] **Jetstream Indexer (Node.js)**: 
  - Standalone service ensuring real-time data synchronization to D1
  - Built with `@atcute/client` and related libraries
  - Deployed on self-hosted infrastructure (Mini PC)
- [ ] **Real-time D1 Sync**: Direct database operations from the Indexer
- [ ] **Global Feed & Search**: D1-based sorting and filtering derived from indexed data

### Phase 4: Frontend (✅ Completed)
- [x] **Hono JSX Renderer**: Basic layout and SSR setup
- [x] **UnoCSS Integration**: Utility-first CSS styling
- [x] **Main Feed**: Infinite scroll and feed UI (Indexed GIFs)
- [x] **Detail Page & Player**: GIF playback and metadata display

## Getting Started

### Prerequisites

- Node.js & pnpm
- Cloudflare Wrangler CLI

### Installation

```bash
pnpm install
```

### Database Setup

Initialize the D1 database:

```bash
pnpm db:generate
pnpm db:migrate:local
```

### Development

Start the development environment (Web + Indexer):

```bash
pnpm dev
# This runs both 'apps/web' and 'apps/indexer' concurrently
```

To run individual services:

```bash
pnpm --filter web dev
pnpm --filter indexer dev
```

> **Note**: The web app must be started at least once to generate the local D1 database file for the indexer to connect to.

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
