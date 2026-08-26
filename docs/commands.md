# Commands

## Root (pnpm workspace)

```bash
pnpm dev                          # pnpm -r dev — start all apps
pnpm build                        # pnpm -r build
pnpm lint                         # biome check .
pnpm lint:fix                     # biome check --write .
pnpm format                       # biome format --write .
```

## Web (`apps/web`)

```bash
pnpm --filter web dev             # Vite dev server (127.0.0.1:5173)
pnpm --filter web build           # unocss -o src/uno.css && vite build
pnpm --filter web preview         # build + vite preview
pnpm --filter web deploy          # build + wrangler deploy
pnpm --filter web lint            # biome check (web only)
pnpm --filter web uno             # regenerate src/uno.css
pnpm --filter web uno:watch       # watch mode for UnoCSS
pnpm --filter web cf-typegen      # wrangler types --env-interface CloudflareBindings
pnpm --filter web lexgen          # lex gen-server ./src/lexicon ./lexicons/**/*.json
```

## Indexer (`apps/indexer`)

```bash
pnpm --filter indexer dev         # tsx watch src/index.ts start
pnpm --filter indexer build       # tsup, esm
pnpm --filter indexer start       # build + node dist/index.js start
pnpm --filter indexer backfill:local    # backfill against local D1
pnpm --filter indexer backfill:remote   # NODE_ENV=production backfill against remote D1
```

## Database (D1 + Drizzle)

```bash
pnpm db:generate                  # drizzle-kit generate (migrations)
pnpm db:migrate:local             # wrangler d1 migrations apply jjalcloud_db --local
pnpm db:migrate:remote            # wrangler d1 migrations apply jjalcloud_db --remote
```

## Tests (Playwright E2E, web only)

There is no unit test framework. The only automated suite is Playwright E2E in
`apps/web/e2e/`; see `apps/web/e2e/README.md` for the two-layer strategy.

```bash
pnpm test:e2e:web                 # deterministic suite (seeded session cookie)
pnpm --filter web test:e2e:install      # playwright install chromium (first run)
pnpm --filter web test:e2e:ui           # Playwright UI mode
pnpm --filter web test:e2e:headed       # headed run
pnpm test:e2e:web:oauth:setup     # interactive bootstrap of e2e/.auth/user.json
pnpm test:e2e:web:oauth           # real-OAuth smoke using saved storageState
```

- **Layer 1 (default)**: `seedSessionCookie()` from `e2e/helpers/auth.ts` fakes the
  session, so post-login SSR is verified without touching a real OAuth provider.
- **Layer 2 (opt-in)**: `E2E_OAUTH=1` projects reuse `e2e/.auth/user.json`
  (gitignored) captured by the bootstrap run.

## Pre-commit (Lefthook, parallel)

- `biome check` on staged `*.{js,jsx,ts,tsx,json,jsonc}`
- `biome format --write` on staged files (auto-stages fixes)

`pnpm prepare` runs `lefthook install`.
