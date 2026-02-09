# AGENTS.md — jjalcloud

Decentralized GIF sharing platform built on AT Protocol (ATProto). Monorepo with pnpm workspaces.

## Project Structure

```
apps/web/          # Cloudflare Workers — Hono + JSX SSR, Vite, UnoCSS, Drizzle ORM (D1)
apps/indexer/      # Node.js — AT Protocol Firehose indexer, better-sqlite3 / D1 HTTP
packages/common/   # Shared — Drizzle schema, Lexicon definitions & generated types
packages/tools/    # Utility scripts (JWK generation)
```

## Build / Lint / Dev Commands

```bash
# Root (runs across all packages)
pnpm dev                          # Start all apps concurrently
pnpm build                        # Build all packages
pnpm lint                         # biome check .
pnpm lint:fix                     # biome check --write .
pnpm format                       # biome format --write .

# Web (apps/web)
pnpm --filter web dev             # Vite dev server (127.0.0.1:5173)
pnpm --filter web build           # UnoCSS + Vite build
pnpm --filter web deploy          # Build + wrangler deploy
pnpm --filter web lint            # biome check (web only)
pnpm --filter web cf-typegen      # Generate Cloudflare bindings types
pnpm --filter web lexgen          # Generate TypeScript from Lexicon definitions

# Indexer (apps/indexer)
pnpm --filter indexer dev         # tsx watch mode
pnpm --filter indexer build       # tsup build
pnpm --filter indexer backfill:local   # Backfill from local D1
pnpm --filter indexer backfill:remote  # Backfill from remote D1

# Database
pnpm db:generate                  # drizzle-kit generate migrations
pnpm db:migrate:local             # Apply migrations locally
pnpm db:migrate:remote            # Apply migrations to production D1
```

## Testing

No test framework is configured. No test files exist.

## Pre-commit Hooks

Lefthook runs on pre-commit (parallel):
- `biome check` on staged `*.{js,jsx,ts,tsx,json,jsonc}` files
- `biome format --write` on staged files (auto-stages fixes)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (web), Node.js (indexer) |
| Framework | Hono (routing + JSX SSR) — NOT React |
| JSX | `hono/jsx` for SSR, `hono/jsx/dom` for client islands |
| Styling | UnoCSS (utility-first, generated to `src/uno.css`) |
| ORM | Drizzle ORM (SQLite / Cloudflare D1) |
| Database | Cloudflare D1 (SQLite), KV for caching |
| Auth | AT Protocol OAuth via `atproto-oauth-client-cloudflare-workers` |
| API Client | `@atcute/client` for AT Protocol RPC calls |
| Bundler | Vite (web), tsup (indexer) |
| Linter/Formatter | Biome 2.3.13 |

## Code Style

### Formatting (Biome)
- **Indent**: Tabs (not spaces)
- **Quotes**: Double quotes for JS/TS strings
- **Semicolons**: Always (Biome default)
- **Import organization**: Biome `organizeImports` is enabled — imports are auto-sorted

### TypeScript
- **Strict mode** enabled (`tsconfig.json`)
- **Prefer `interface`** for component props and object shapes
- **Use `type`** for unions, utility types, and re-exports (`type HonoEnv = { ... }`)
- **Prefer `type` imports**: `import type { FC } from "hono/jsx"` — separate type-only imports
- **No `as any`**: Avoid. The codebase has one documented exception in `db/index.ts` with a `biome-ignore` comment
- **No `@ts-ignore` / `@ts-expect-error`**: Not used anywhere

### Naming Conventions
- **Files**: PascalCase for components (`GifCard.tsx`, `Button.tsx`), camelCase for modules (`helpers.ts`, `client.ts`)
- **Components**: PascalCase (`GifCard`, `Layout`, `UploadForm`)
- **Variables/functions**: camelCase (`fetchProfile`, `createRpcClient`)
- **Constants**: UPPER_SNAKE_CASE (`SESSION_COOKIE`, `MAX_GIF_SIZE`, `GIF_COLLECTION`)
- **Types/Interfaces**: PascalCase (`GifView`, `HonoEnv`, `AuthenticatedEnv`)
- **DB columns**: snake_case in SQL (`created_at`), camelCase in Drizzle schema (`createdAt`)

### Import Style
- External packages first, then internal modules, then relative imports
- Named exports preferred; route modules use `export default`
- Use workspace package imports: `import { gifs } from "@jjalcloud/common/db/schema"`
- Use barrel exports via `index.ts` in: `components/`, `utils/`, `middleware/`, `pages/`, `auth/`

### Component Patterns
- **SSR components**: Use `hono/jsx` — `import type { FC } from "hono/jsx"`
- **Client islands**: Must have `/** @jsxImportSource hono/jsx/dom */` pragma at file top
- Islands are mounted in `client.tsx` via `render()` into DOM elements with `data-props` JSON
- Props interfaces defined above component, inline in same file
- Functional components only — `export const Component: FC<Props> = ({ ... }) => { ... }`
- Use `class` not `className` for HTML attributes (Hono JSX convention)
- Unused props prefixed with underscore: `tags: _tags = []`

### Route / API Patterns
- Routes are Hono instances exported as default: `const gif = new Hono<Env>(); export default gif;`
- Mounted in `index.tsx`: `app.route("/api/gif", gifRoutes)`
- Auth middleware: `requireAuth` (returns 401) or `optionalAuth` (proceeds without session)
- Error responses: `c.json({ error: "Type", message: "Details" }, statusCode)`
- Success responses: `c.json({ success: true, ...data }, 201)`
- Use `extractErrorMessage(error)` for consistent error messages

### Database Patterns
- Schema defined in `packages/common/src/db/schema.ts` using Drizzle `sqliteTable()`
- Web app: `const db = drizzle(c.env.jjalcloud_db)` (D1 binding from Hono context)
- Indexer: `createLocalDatabase()` (dev) or `createRemoteDatabase(config)` (prod)
- Prefer `.all()` for lists, `.get()` for single records
- Upsert pattern: `.insert().values().onConflictDoUpdate()`
- Tags stored as JSON string in DB, parsed with `JSON.parse()` on read

### Error Handling
- Try/catch with `console.error("Context:", error)` logging
- API routes return JSON error responses with status codes
- Empty `catch {}` blocks allowed only for non-critical fallbacks (e.g., profile fetch)
- Indexer uses `pino` structured logging: `logger.error({ err }, "Message")`

### Environment Variables
- Web: Accessed via Hono context `c.env.BINDING_NAME` (Cloudflare bindings)
- Indexer: Validated with Zod schema in `env.ts`, accessed via `env.VAR_NAME`
- Never commit `.env` files — use `.env.example` as reference

## Architecture Notes

### Islands Architecture
The web app uses SSR with selective client hydration ("islands"):
1. Server renders full HTML with Hono JSX
2. Interactive components mount into placeholder `<div id="xxx-root" data-props='...'>`
3. `client.tsx` hydrates each island with `hono/jsx/dom`'s `render()`
4. Islands: `UploadForm`, `EditForm`, `InfiniteScroll`, `DetailActions`

### AT Protocol Integration
- Collection NSIDs: `com.jjalcloud.feed.gif`, `com.jjalcloud.feed.like`
- Records created with `TID.nextStr()` as rkey
- Blob upload → `com.atproto.repo.uploadBlob`, then `putRecord` with BlobRef
- Firehose indexer filters for `com.jjalcloud.feed.*` collections
- Lexicon types auto-generated — do NOT edit `src/lexicon/` manually
