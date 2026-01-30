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

### Phase 2: Core Logic (🚧 In Progress)
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
- [ ] **Jetstream Indexer**: Collect/sync `jjalcloud` records from the entire network (Cron Worker)
- [ ] **Durable Objects**: Indexing cursor management and real-time state synchronization
- [ ] **Cloudflare D1 Usage**: Global indexing and caching layer (Read Model) for PDS data
- [ ] **Global Feed & Search**: D1-based sorting (latest), tag filtering, search API

### Phase 4: Frontend (🚧 In Progress)
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

Start the development server:

```bash
pnpm dev
```

For styling updates, run UnoCSS in watch mode in a separate terminal:

```bash
pnpm uno:watch
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
