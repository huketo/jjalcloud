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

### Phase 3: Indexing & Real-time (✅ Completed)
- [x] **Monorepo Structure**: Separate `apps/web` (Cloudflare Workers) and `apps/indexer` (Node.js) using pnpm workspace
- [x] **Jetstream Indexer (Node.js)**: 
  - Standalone service ensuring real-time data synchronization to D1
  - Built with Jetstream WebSocket client (JSON-based, server-side collection filtering)
  - Filters and indexes `com.jjalcloud.feed.gif` and `com.jjalcloud.feed.like` collections
  - Deployed on self-hosted infrastructure (Mini PC)
- [x] **Real-time D1 Sync**: Direct database operations from the Indexer
- [x] **Backfill Support**: Historical record indexing via `com.atproto.repo.listRecords` API
- [x] **User Management**: OAuth login saves user info to D1 for backfill targeting
- [x] **Global Feed**: D1-based sorting and filtering derived from indexed data

### Phase 4: Frontend (✅ Completed)
- [x] **Hono JSX Renderer**: Basic layout and SSR setup
- [x] **UnoCSS Integration**: Utility-first CSS styling
- [x] **Main Feed**: Simple feed UI (Indexed GIFs)
- [x] **Detail Page & Player**: GIF playback and metadata display

### Phase 5: Enhanced Features (🚧 Planned)
- [x] **Infinite Scroll**: Auto-loading more content as users scroll
- [ ] **Search Functionality**:
  - [ ] Search GIFs by keyword and tags
  - [ ] Search users by DID and handle
- [ ] **Social Features**:
  - [ ] Follow/Unfollow users
  - [ ] Profile page enhancements:
    - [ ] Following/Followers tabs
    - [ ] Liked GIFs list view

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

### Indexer Setup

The indexer runs as a standalone Node.js service that connects to the local D1 database.

**Environment Variables** (`.env` in `apps/indexer`):

```env
NODE_ENV=development
JETSTREAM_URL=wss://jetstream2.us-east.bsky.network/subscribe
LOG_LEVEL=info

# For production
# NODE_ENV=production
# CLOUDFLARE_ACCOUNT_ID=your_account_id
# CLOUDFLARE_DATABASE_ID=your_database_id
# CLOUDFLARE_API_TOKEN=your_api_token
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

#### Lexicon linting:

[goat](https://github.com/bluesky-social/goat): Go AT Protocol CLI tool

```bash
goat lex lint ./packages/common/lexicons
```

## Database Schema

The D1 database includes the following tables:

- **`users`**: Stores user information from OAuth login (DID, handle, display name, avatar)
- **`gifs`**: Indexed GIF records from AT Protocol (URI, CID, author, title, alt, tags, file blob)
- **`likes`**: Indexed like records (subject URI, author DID, rkey)

## Indexer Commands

The indexer supports two main operations:

### Real-time Indexing (Default)

Start the Jetstream indexer to capture new records in real-time:

```bash
pnpm --filter indexer dev    # Development mode with watch
pnpm --filter indexer start  # Production mode
```

### Backfill Existing Records

Backfill historical GIF and Like records for specific users:

```bash
# Backfill all users from the database
pnpm --filter indexer backfill

# Backfill specific DIDs
pnpm --filter indexer backfill -- --dids did:plc:xxx,did:plc:yyy

# Backfill from a custom PDS
pnpm --filter indexer backfill -- --dids did:plc:xxx --pds https://custom.pds
```

## Project Structure

```
jjalcloud/
├── apps/
│   ├── web/              # Cloudflare Workers (Hono + JSX)
│   │   ├── src/
│   │   │   ├── auth/     # OAuth client
│   │   │   ├── routes/   # API routes
│   │   │   ├── pages/    # JSX pages
│   │   │   └── index.tsx
│   │   └── drizzle/      # D1 migrations
│   └── indexer/          # Node.js Jetstream indexer
│       └── src/
│           ├── index.ts  # Main indexer + CLI
│           ├── backfill.ts
│           └── db/       # Database operations
└── packages/
    └── common/           # Shared code
        ├── lexicons/     # Lexicon definitions
        └── src/
            ├── db/       # Database schema
            └── lexicon/  # Generated types
```

