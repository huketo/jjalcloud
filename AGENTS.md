# AGENTS.md — jjalcloud

Decentralized GIF sharing platform built on AT Protocol (ATProto). pnpm workspace monorepo.

This file is the canonical agent doc and stays at guide/routing level — detail lives under
`docs/`. `CLAUDE.md` is a pointer that imports this file; edit **this** file, never the pointer.

## Layout

| Path                | What                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| `apps/web/`         | Cloudflare Workers — Hono + JSX SSR, Vite, UnoCSS, Drizzle ORM (D1)      |
| `apps/indexer/`     | Node.js — Jetstream indexer (JSON WebSocket), better-sqlite3 / D1 HTTP    |
| `packages/common/`  | Shared — Drizzle schema, Lexicon definitions & generated types           |
| `packages/tools/`   | Utility scripts (JWK generation)                                         |

## Where to look

| Need                                             | Read                            |
| ------------------------------------------------ | ------------------------------- |
| Build, dev, deploy, DB, and E2E commands         | `docs/commands.md`              |
| Formatting, naming, component/route/DB patterns  | `docs/code-style.md`            |
| Tech stack, islands architecture, ATProto flow   | `docs/architecture.md`          |
| E2E strategy and OAuth fixtures                  | `apps/web/e2e/README.md`        |
| Domain glossary + ADR consumer rules             | `docs/agents/domain.md`         |

## Hard rules

- Hono JSX, **not** React. Use `class`, not `className`.
- Client islands must open with `/** @jsxImportSource hono/jsx/dom */`.
- Never hand-edit `apps/web/src/lexicon/` — regenerate with `pnpm --filter web lexgen`.
- Tabs, double quotes, Biome-organized imports. No `as any`, no `@ts-expect-error`.
- Never commit `.env`; `.env.example` is the reference.
- Verification: `pnpm lint` plus `pnpm test:e2e:web` (Playwright) — there is no unit test framework.

## Agent skills

### Issue tracker

GitHub Issues on `huketo/jjalcloud`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
