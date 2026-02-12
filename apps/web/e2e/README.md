# E2E Test Strategy

## Why this exists

`jjalcloud` uses ATProto OAuth. Full provider login on every Playwright run is
slow and flaky, so this repository uses layered E2E strategies.

## Layer 1 (default): deterministic UI tests

- Seed session cookie in browser context with `seedSessionCookie()` from
  `e2e/helpers/auth.ts`.
- Validate post-login SSR behavior (nav state, protected page entry) without
  hitting external OAuth provider UI.
- Validate Open Graph tags on key pages (`e2e/og.spec.ts`).

## Layer 2 (optional): real OAuth smoke with storageState

- Setup file: `e2e/auth.oauth.setup.ts`
- Smoke file: `e2e/oauth-authenticated.oauth.spec.ts`
- Auth file: `e2e/.auth/user.json` (gitignored)

The setup project works as follows:

1. Reuses existing `e2e/.auth/user.json` when present.
2. If missing, requires manual bootstrap mode (`E2E_OAUTH_BOOTSTRAP=1`).
3. Captures `storageState` after successful OAuth return.

## Commands

- Run deterministic suite: `pnpm --filter web test:e2e`
- Bootstrap OAuth storage state (interactive):
  `pnpm --filter web test:e2e:oauth:setup`
- Run OAuth smoke using saved storage state:
  `pnpm --filter web test:e2e:oauth`

## Coverage scope

Included:

- Authenticated SSR navigation state (`Upload` visible, `Login` hidden)
- Protected route checks for `/upload` with/without session cookie
- OG meta tag presence/values on representative pages

Excluded from deterministic suite:

- External OAuth provider UI reliability
- Full token exchange/callback validation against live provider
- API mutations that require real `requireAuth` session restoration
