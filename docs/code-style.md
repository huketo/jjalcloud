# Code Style

## Formatting (Biome 2.3.13)

- **Indent**: tabs, not spaces
- **Quotes**: double quotes for JS/TS strings
- **Semicolons**: always (Biome default)
- **Imports**: `organizeImports` is enabled — imports are auto-sorted

## TypeScript

- **Strict mode** enabled (`tsconfig.json`)
- **Prefer `interface`** for component props and object shapes
- **Use `type`** for unions, utility types, and re-exports (`type HonoEnv = { ... }`)
- **Prefer `type` imports**: `import type { FC } from "hono/jsx"`
- **No `as any`** — one documented exception in `db/index.ts` carries a `biome-ignore`
- **No `@ts-ignore` / `@ts-expect-error`** anywhere in the codebase

## Naming

- **Files**: PascalCase for components (`GifCard.tsx`, `Button.tsx`), camelCase for
  modules (`helpers.ts`, `client.ts`)
- **Components**: PascalCase (`GifCard`, `Layout`, `UploadForm`)
- **Variables / functions**: camelCase (`fetchProfile`, `createRpcClient`)
- **Constants**: UPPER_SNAKE_CASE (`SESSION_COOKIE`, `MAX_GIF_SIZE`, `GIF_COLLECTION`)
- **Types / interfaces**: PascalCase (`GifView`, `HonoEnv`, `AuthenticatedEnv`)
- **DB columns**: snake_case in SQL (`created_at`), camelCase in Drizzle schema (`createdAt`)

## Imports

- External packages first, then internal modules, then relative imports
- Named exports preferred; route modules use `export default`
- Workspace imports: `import { gifs } from "@jjalcloud/common/db/schema"`
- Barrel `index.ts` exists in `components/`, `utils/`, `middleware/`, `pages/`, `auth/`

## Components

- **SSR**: `hono/jsx` — `import type { FC } from "hono/jsx"`
- **Client islands**: file must open with `/** @jsxImportSource hono/jsx/dom */`
- Islands mount from `client.tsx` via `render()` into elements carrying `data-props` JSON
- Props interfaces defined above the component, inline in the same file
- Functional components only — `export const Component: FC<Props> = ({ ... }) => { ... }`
- Use `class`, not `className` (Hono JSX convention)
- Unused props prefixed with underscore: `tags: _tags = []`

## Routes / API

- A route module is a Hono instance exported as default:
  `const gif = new Hono<Env>(); export default gif;`
- Mounted in `index.tsx`: `app.route("/api/gif", gifRoutes)`
- Auth middleware: `requireAuth` (401 on no session) or `optionalAuth` (proceeds)
- Errors: `c.json({ error: "Type", message: "Details" }, statusCode)`
- Success: `c.json({ success: true, ...data }, 201)`
- Use `extractErrorMessage(error)` for consistent messages

## Database

- Schema lives in `packages/common/src/db/schema.ts` via Drizzle `sqliteTable()`
- Web: `const db = drizzle(c.env.jjalcloud_db)` (D1 binding off the Hono context)
- Indexer: `createLocalDatabase()` (dev) or `createRemoteDatabase(config)` (prod)
- `.all()` for lists, `.get()` for single records
- Upsert: `.insert().values().onConflictDoUpdate()`
- Tags are stored as a JSON string, `JSON.parse()` on read

## Errors

- `try`/`catch` with `console.error("Context:", error)`
- API routes return JSON error responses with status codes
- Empty `catch {}` only for non-critical fallbacks (e.g. profile fetch)
- Indexer uses `pino`: `logger.error({ err }, "Message")`

## Environment

- Web: Cloudflare bindings via `c.env.BINDING_NAME`
- Indexer: Zod-validated in `env.ts`, read as `env.VAR_NAME`
- Never commit `.env` — `.env.example` is the reference
