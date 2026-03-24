# HonoX Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate jjalcloud from bare Hono SSR to HonoX with file-based routing, islands architecture, React renderer, and Tailwind CSS.

**Architecture:** All source code moves from `src/` to `app/` (HonoX convention). `app/server.ts` uses `createApp()`. Pages are file-routed under `app/routes/`. Interactive components live in `app/islands/`. API routes export Hono instances directly.

**Tech Stack:** HonoX, React, Tailwind CSS v4, Vite, `@hono/vite-build/bun`, Drizzle ORM, Bun runtime

**Spec:** `docs/superpowers/specs/2026-03-25-honox-frontend-migration-design.md`

---

## File Map

### New files to create
- `app/server.ts` — HonoX entry via `createApp()`
- `app/client.ts` — Islands hydration entry
- `app/style.css` — Tailwind import
- `app/global.d.ts` — `@hono/react-renderer` types
- `app/routes/_renderer.tsx` — Layout with OG, Tailwind, client script
- `app/routes/_middleware.ts` — Logger, CORS
- `app/routes/_error.tsx` — Error page
- `app/routes/index.tsx` — Home feed (placeholder)
- `app/routes/search.tsx` — Search page (placeholder)
- `app/routes/upload.tsx` — Upload page (placeholder)
- `app/routes/gifs/[cid].tsx` — GIF detail (placeholder)
- `app/routes/profile/[identifier].tsx` — Profile (placeholder)
- `vite.config.ts` — HonoX + Bun + Tailwind

### Files to move (src/ → app/)
- `src/env.ts` → `app/env.ts`
- `src/db/*` → `app/db/*`
- `src/lib/*` → `app/lib/*`
- `src/auth/*` → `app/auth/*`
- `src/indexer/*` → `app/indexer/*`
- `src/lexicon/*` → `app/lexicon/*`
- `src/routes/api/index.ts` → `app/routes/api/index.ts`
- `src/routes/oauth/index.ts` → `app/routes/oauth/index.ts`
- `src/routes/xrpc/index.ts` → `app/routes/xrpc/index.ts`
- `src/routes/tenor/*` → `app/routes/v2/*`

### Files to delete
- `src/routes/web/index.tsx`
- `src/routes/web/layout.tsx`
- `src/server.ts` (replaced by `app/server.ts`)

### Files to modify
- `package.json` — Remove workspaces, add deps, update scripts
- `tsconfig.json` — `jsxImportSource: react`, include `app`
- `CLAUDE.md` — Update frontend section for HonoX/Vite
- `Dockerfile` — Update build/serve commands
- `drizzle.config.ts` — Update schema path
- `bunfig.toml` — Update test paths
- All test files — Update relative import paths after move

---

## Task 1: Install dependencies and update configs

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `CLAUDE.md`
- Create: `vite.config.ts`

- [ ] **Step 1: Install HonoX and related dependencies**

```bash
bun add honox @hono/react-renderer react react-dom
bun add -D @hono/vite-build vite @tailwindcss/vite tailwindcss @types/react @types/react-dom
```

- [ ] **Step 2: Remove workspaces from package.json**

Remove the entire `workspaces` block from `package.json`:

```json
// REMOVE this block:
"workspaces": {
  "packages": ["apps/*", "packages/*"],
  "catalog": {
    "drizzle-kit": "^0.31.8",
    "drizzle-orm": "^0.45.1"
  }
},
```

Also remove `"module": "index.ts"` (unused).

- [ ] **Step 3: Update package.json scripts**

Replace scripts with:

```json
{
  "dev": "vite dev",
  "build": "vite build --mode client && vite build",
  "serve": "bun run dist/index.js",
  "dev:infra": "docker compose up -d",
  "dev:infra:down": "docker compose down",
  "dev:seed": "bun run tests/setup.ts",
  "format": "bunx biome format --write .",
  "lint": "bunx biome lint .",
  "check": "bunx biome check --write .",
  "typecheck": "bunx tsc --noEmit",
  "test": "bun test app/",
  "test:integration": "bun test --env-file .env.test tests/integration/",
  "test:setup": "bun run --env-file .env.test tests/setup.ts",
  "codegen": "bunx @atcute/lex-cli generate",
  "db:generate": "bunx drizzle-kit generate",
  "db:migrate": "bunx drizzle-kit migrate"
}
```

- [ ] **Step 4: Update tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": ".",
    "paths": {
      "@/*": ["./app/*"]
    }
  },
  "include": ["app"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Create vite.config.ts**

```ts
import { defineConfig } from "vite";
import honox from "honox/vite";
import build from "@hono/vite-build/bun";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
	if (mode === "client") {
		return {
			build: {
				rollupOptions: {
					input: ["./app/client.ts"],
					output: {
						entryFileNames: "static/client.js",
						chunkFileNames: "static/assets/[name]-[hash].js",
						assetFileNames: "static/assets/[name].[ext]",
					},
				},
				emptyOutDir: false,
			},
		};
	}
	return {
		plugins: [
			honox({ client: { input: ["/app/style.css"] } }),
			build(),
			tailwindcss(),
		],
	};
});
```

- [ ] **Step 6: Update CLAUDE.md frontend section**

Replace the `## Frontend` section with:

```markdown
## Frontend

Uses HonoX (Hono meta-framework) with file-based routing and islands architecture.

- `vite dev` for development server
- `vite build --mode client && vite build` for production build
- `bun run dist/index.js` to serve production build
- Pages live in `app/routes/` — file path = URL path
- Interactive components live in `app/islands/` — hydrated on client
- Renderer: React via `@hono/react-renderer`
- Styling: Tailwind CSS v4 via `@tailwindcss/vite`
- API routes: Export Hono instances from `app/routes/<path>/index.ts`
```

- [ ] **Step 7: Add `dist/` and `.vite/` to .gitignore if missing**

Append to `.gitignore`:

```
.vite/
```

(`dist/` is already present.)

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock tsconfig.json vite.config.ts CLAUDE.md .gitignore
git commit -m "chore: add HonoX dependencies and update configs"
```

---

## Task 2: Move backend code from src/ to app/

**Files:**
- Move: All files under `src/` except `src/routes/web/` and `src/server.ts`
- Delete: `src/routes/web/index.tsx`, `src/routes/web/layout.tsx`, `src/server.ts`, `src/server.test.ts`
- Modify: `drizzle.config.ts` — Update schema path

- [ ] **Step 1: Create app directory structure**

```bash
mkdir -p app/routes/v2 app/routes/api app/routes/oauth app/routes/xrpc app/routes/gifs app/routes/profile app/islands
```

- [ ] **Step 2: Move backend modules**

```bash
mv src/env.ts app/env.ts
mv src/db app/db
mv src/lib app/lib
mv src/auth app/auth
mv src/indexer app/indexer
mv src/lexicon app/lexicon
```

- [ ] **Step 3: Move API routes**

```bash
mv src/routes/api/index.ts app/routes/api/index.ts
mv src/routes/oauth/index.ts app/routes/oauth/index.ts
mv src/routes/xrpc/index.ts app/routes/xrpc/index.ts
mv src/routes/xrpc/xrpc.test.ts app/routes/xrpc/xrpc.test.ts
```

- [ ] **Step 4: Move tenor routes to v2**

```bash
mv src/routes/tenor/index.ts app/routes/v2/index.ts
mv src/routes/tenor/search.ts app/routes/v2/search.ts
mv src/routes/tenor/featured.ts app/routes/v2/featured.ts
mv src/routes/tenor/posts.ts app/routes/v2/posts.ts
mv src/routes/tenor/tenor.test.ts app/routes/v2/tenor.test.ts
mv src/routes/tenor/test-preload.ts app/routes/v2/test-preload.ts
```

- [ ] **Step 5: Delete old web routes, server, and server test**

```bash
rm -rf src/routes/web
rm src/server.ts
rm src/server.test.ts
rm -rf src/
```

`src/server.test.ts` only tested a standalone health endpoint — this is replaced by `app/routes/health.ts` (Task 8).

- [ ] **Step 6: Update drizzle.config.ts schema path**

Change `src/db/schema.ts` to `app/db/schema.ts` in `drizzle.config.ts`.

- [ ] **Step 7: Update bunfig.toml test preload path if present**

Change any `src/` references to `app/` in `bunfig.toml`.

- [ ] **Step 8: Delete .gitmodules**

```bash
rm -f .gitmodules
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move src/ to app/ for HonoX structure"
```

---

## Task 3: Rewrite API route exports for HonoX file routing

HonoX file-based routing requires each route file to `export default` a Hono instance. The existing files use named exports. Additionally, XRPC handlers use full paths like `/xrpc/com.jjalcloud...` but HonoX auto-mounts at `/xrpc/`, so paths must be stripped.

**Files:**
- Modify: `app/routes/xrpc/index.ts` — Strip `/xrpc/` prefix, change to default export
- Modify: `app/routes/api/index.ts` — Change to default export
- Modify: `app/routes/oauth/index.ts` — Change to default export
- Modify: `app/routes/v2/index.ts` — Change to default export
- Modify: `app/routes/v2/search.ts` — Change to default export
- Modify: `app/routes/v2/featured.ts` — Change to default export
- Modify: `app/routes/v2/posts.ts` — Change to default export

- [ ] **Step 1: Rewrite xrpc/index.ts — strip /xrpc/ prefix and default export**

The handlers currently use paths like `/xrpc/com.jjalcloud.feed.getGif`. Since HonoX mounts this file at `/xrpc`, the handlers would become `/xrpc/xrpc/...`. Strip the `/xrpc/` prefix:

```ts
// app/routes/xrpc/index.ts
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client";
import { gifs } from "../../db/schema";
import { getFeed, getLikeCount, getTrending, searchGifs } from "../../lib/search";

const app = new Hono();

app.get("/com.jjalcloud.feed.getGif", async (c) => {
	// ... (same handler body, just path changed)
});

app.get("/com.jjalcloud.feed.getGifs", async (c) => {
	// ... same body
});

app.get("/com.jjalcloud.feed.searchGifs", async (c) => {
	// ... same body
});

app.get("/com.jjalcloud.feed.getFeed", async (c) => {
	// ... same body
});

app.get("/com.jjalcloud.feed.getTrending", async (c) => {
	// ... same body
});

export default app;
```

- [ ] **Step 2: Rewrite api/index.ts — default export**

Change `export { api }` to `export default api` (rename variable to `app` for consistency):

```ts
// app/routes/api/index.ts — change last line:
// Before: export { api };
// After:
export default app;
```

Also rename `const api = new Hono<AuthEnv>()` to `const app = new Hono<AuthEnv>()` and update all references.

- [ ] **Step 3: Rewrite oauth/index.ts — default export**

```ts
// Before: export { oauth };
// After:  export default app;
```

Rename `const oauth = new Hono()` to `const app = new Hono()`.

- [ ] **Step 4: Rewrite v2/index.ts — default export and rename sub-routes**

The tenor sub-routes (`search.ts`, `featured.ts`, `posts.ts`) use named exports. Update them:

```ts
// app/routes/v2/search.ts
// Before: export { search };
// After:  export default search;

// app/routes/v2/featured.ts
// Before: export { featured };
// After:  export default featured;

// app/routes/v2/posts.ts
// Before: export { posts };
// After:  export default posts;
```

Then update `app/routes/v2/index.ts`:

```ts
// app/routes/v2/index.ts
import { Hono } from "hono";
import search from "./search";
import featured from "./featured";
import posts from "./posts";

const app = new Hono();
app.route("/", search);
app.route("/", featured);
app.route("/", posts);

export default app;
```

- [ ] **Step 5: Update xrpc.test.ts — default import and strip /xrpc/ from request paths**

The test imports the named export and makes requests like `xrpc.request("/xrpc/com.jjalcloud.feed.getGif")`. After the path change, update both:

1. Change import: `import { xrpc } from "./index"` → `import app from "./index"`
2. Replace all `xrpc.request(...)` with `app.request(...)`
3. Strip `/xrpc/` prefix from ALL request paths in tests:
   - `/xrpc/com.jjalcloud.feed.getGif` → `/com.jjalcloud.feed.getGif`
   - `/xrpc/com.jjalcloud.feed.getGifs` → `/com.jjalcloud.feed.getGifs`
   - `/xrpc/com.jjalcloud.feed.searchGifs` → `/com.jjalcloud.feed.searchGifs`
   - `/xrpc/com.jjalcloud.feed.getFeed` → `/com.jjalcloud.feed.getFeed`
   - `/xrpc/com.jjalcloud.feed.getTrending` → `/com.jjalcloud.feed.getTrending`

- [ ] **Step 6: Update tenor.test.ts to import default export**

```ts
// Before: import { tenor } from "./index";
// After:  import app from "./index";
// Then replace all `tenor.request(...)` with `app.request(...)`
```

- [ ] **Step 7: Run typecheck**

```bash
bunx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Run tests**

```bash
bun test app/
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: rewrite route exports for HonoX file routing"
```

---

## Task 4: Create HonoX server entry

**Files:**
- Create: `app/server.ts`

- [ ] **Step 1: Create app/server.ts**

```ts
import { createApp } from "honox/server";
import { showRoutes } from "hono/dev";
import { db } from "./db/client";
import { env } from "./env";
import { startJetstream } from "./indexer/jetstream";
import { sql } from "drizzle-orm";

const app = createApp();

// Start indexer
startJetstream(db);

// Refresh trending materialized view every hour
setInterval(
	async () => {
		try {
			await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY trending_gifs`);
			console.log("[trending] Materialized view refreshed");
		} catch (e) {
			console.error("[trending] Refresh failed:", e);
		}
	},
	60 * 60 * 1000,
);

showRoutes(app);

export default app;
```

- [ ] **Step 2: Commit**

```bash
git add app/server.ts
git commit -m "feat: add HonoX server entry with createApp()"
```

---

## Task 5: Create middleware

**Files:**
- Create: `app/routes/_middleware.ts` — Logger only (global)
- Create: `app/routes/v2/_middleware.ts` — CORS for Tenor API
- Create: `app/routes/xrpc/_middleware.ts` — CORS for XRPC

- [ ] **Step 1: Create global _middleware.ts (logger only)**

```ts
// app/routes/_middleware.ts
import { createRoute } from "honox/factory";
import { logger } from "hono/logger";

export default createRoute(logger());
```

- [ ] **Step 2: Create v2/_middleware.ts (CORS for Tenor API)**

```ts
// app/routes/v2/_middleware.ts
import { createRoute } from "honox/factory";
import { cors } from "hono/cors";

export default createRoute(cors());
```

- [ ] **Step 3: Create xrpc/_middleware.ts (CORS for XRPC)**

```ts
// app/routes/xrpc/_middleware.ts
import { createRoute } from "honox/factory";
import { cors } from "hono/cors";

export default createRoute(cors());
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/_middleware.ts app/routes/v2/_middleware.ts app/routes/xrpc/_middleware.ts
git commit -m "feat: add middleware (global logger, per-route CORS)"
```

---

## Task 6: Create renderer, client entry, and styles

**Files:**
- Create: `app/routes/_renderer.tsx`
- Create: `app/client.ts`
- Create: `app/style.css`
- Create: `app/global.d.ts`

- [ ] **Step 1: Create global.d.ts**

```ts
import "@hono/react-renderer";

declare module "@hono/react-renderer" {
	interface Props {
		title?: string;
	}
}
```

- [ ] **Step 2: Create _renderer.tsx**

```tsx
import { reactRenderer } from "@hono/react-renderer";

export default reactRenderer(({ children, title }) => {
	return (
		<html lang="ko">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				{import.meta.env.PROD ? (
					<>
						<link rel="stylesheet" href="/static/assets/style.css" />
						<script type="module" src="/static/client.js" />
					</>
				) : (
					<>
						<link rel="stylesheet" href="/app/style.css" />
						<script type="module" src="/app/client.ts" />
					</>
				)}
				{title ? <title>{title} - jjalcloud</title> : <title>jjalcloud</title>}
			</head>
			<body>
				<nav>
					<a href="/">jjalcloud</a>
				</nav>
				<main>{children}</main>
			</body>
		</html>
	);
});
```

- [ ] **Step 3: Create client.ts**

```ts
import { createClient } from "honox/client";

createClient({
	hydrate: async (elem, root) => {
		const { hydrateRoot } = await import("react-dom/client");
		hydrateRoot(root, elem);
	},
	createElement: async (type: any, props: any) => {
		const { createElement } = await import("react");
		return createElement(type, props);
	},
});
```

- [ ] **Step 4: Create style.css**

```css
@import "tailwindcss" source("../app");
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/_renderer.tsx app/client.ts app/style.css app/global.d.ts
git commit -m "feat: add HonoX renderer, client entry, and Tailwind setup"
```

---

## Task 7: Create placeholder page routes

**Files:**
- Create: `app/routes/index.tsx`
- Create: `app/routes/search.tsx`
- Create: `app/routes/upload.tsx`
- Create: `app/routes/gifs/[cid].tsx`
- Create: `app/routes/profile/[identifier].tsx`
- Create: `app/routes/_error.tsx`

- [ ] **Step 1: Create home page**

```tsx
// app/routes/index.tsx
import { createRoute } from "honox/factory";

export default createRoute((c) => {
	return c.render(<h1>jjalcloud</h1>, { title: "Home" });
});
```

- [ ] **Step 2: Create search page**

```tsx
// app/routes/search.tsx
import { createRoute } from "honox/factory";

export default createRoute((c) => {
	const q = c.req.query("q") ?? "";
	return c.render(
		<div>
			<h1>Search</h1>
			<p>Query: {q}</p>
		</div>,
		{ title: "Search" },
	);
});
```

- [ ] **Step 3: Create upload page**

```tsx
// app/routes/upload.tsx
import { createRoute } from "honox/factory";

export default createRoute((c) => {
	return c.render(<h1>Upload</h1>, { title: "Upload" });
});
```

- [ ] **Step 4: Create GIF detail page**

```tsx
// app/routes/gifs/[cid].tsx
import { createRoute } from "honox/factory";

export default createRoute((c) => {
	const cid = c.req.param("cid");
	return c.render(
		<div>
			<h1>GIF Detail</h1>
			<p>CID: {cid}</p>
		</div>,
		{ title: "GIF" },
	);
});
```

- [ ] **Step 5: Create profile page**

```tsx
// app/routes/profile/[identifier].tsx
import { createRoute } from "honox/factory";

export default createRoute((c) => {
	const identifier = c.req.param("identifier");
	const isDid = identifier.startsWith("did:");
	return c.render(
		<div>
			<h1>Profile</h1>
			<p>{isDid ? "DID" : "Handle"}: {identifier}</p>
		</div>,
		{ title: "Profile" },
	);
});
```

- [ ] **Step 6: Create error page**

HonoX `_error.tsx` exports an `ErrorHandler` from `hono`. It receives `(error, c)` and should return a Response. Use `c.render()` for layout integration.

```tsx
// app/routes/_error.tsx
import type { ErrorHandler } from "hono";
import type { HTTPException } from "hono/http-exception";

const handler: ErrorHandler = (e, c) => {
	const status = "status" in e ? (e as HTTPException).status : 500;
	if (status === 404) {
		return c.render(<h1>404 - Not Found</h1>, { title: "Not Found" });
	}
	return c.render(
		<div>
			<h1>Error</h1>
			<p>{import.meta.env.DEV ? e.message : "Something went wrong"}</p>
		</div>,
		{ title: "Error" },
	);
};

export default handler;
```

- [ ] **Step 7: Commit**

```bash
git add app/routes/index.tsx app/routes/search.tsx app/routes/upload.tsx app/routes/gifs/[cid].tsx app/routes/profile/[identifier].tsx app/routes/_error.tsx
git commit -m "feat: add placeholder page routes"
```

---

## Task 8: Move media endpoint into file-based route

The `/media/:author/:rkey/:variant` endpoint was in `src/server.ts`. It needs a new home.

**Files:**
- Create: `app/routes/media/[author]/[rkey]/[variant].ts`

- [ ] **Step 1: Create media route**

```ts
// app/routes/media/[author]/[rkey]/[variant].ts
import { Hono } from "hono";
import { env } from "../../../../env";
import { convertToVideo } from "../../../../indexer/media";
import { existsInR2, r2Key } from "../../../../lib/r2";

const app = new Hono();

app.get("/", async (c) => {
	const author = c.req.param("author");
	const rkey = c.req.param("rkey");
	const variant = c.req.param("variant");

	if (variant !== "mp4" && variant !== "tinymp4" && variant !== "webm") {
		return c.text("invalid variant", 400);
	}

	const key = r2Key(author, rkey, variant);
	if (await existsInR2(key)) {
		return c.redirect(`${env.R2_PUBLIC_URL}/${key}`);
	}

	try {
		const url = await convertToVideo(author, rkey, variant);
		return c.redirect(url);
	} catch {
		const originalKey = r2Key(author, rkey, "original.gif");
		return c.redirect(`${env.R2_PUBLIC_URL}/${originalKey}`);
	}
});

export default app;
```

- [ ] **Step 2: Create health route**

```ts
// app/routes/health.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 3: Commit**

```bash
mkdir -p app/routes/media/\[author\]/\[rkey\]
git add app/routes/media app/routes/health.ts
git commit -m "feat: add media conversion and health check routes"
```

---

## Task 9: Update Dockerfile

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Update Dockerfile for HonoX build**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM install AS build
COPY . .
RUN bun run build

FROM base AS release
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist

# Install ffmpeg for video conversion
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "chore: update Dockerfile for HonoX build"
```

---

## Task 10: Verify everything works

- [ ] **Step 1: Run typecheck**

```bash
bunx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run dev server**

```bash
bun run dev
```

Expected: Vite dev server starts, visiting `http://localhost:5173/` shows "jjalcloud" home placeholder.

- [ ] **Step 3: Verify routes**

Visit these URLs and confirm they render:
- `http://localhost:5173/` → Home
- `http://localhost:5173/search?q=test` → Search
- `http://localhost:5173/gifs/test123` → GIF detail
- `http://localhost:5173/profile/abc.bsky.social` → Profile (handle)
- `http://localhost:5173/health` → `{"ok": true}`

- [ ] **Step 4: Run unit tests**

```bash
bun test app/
```

Expected: All existing tests pass with updated import paths.

- [ ] **Step 5: Build production bundle**

```bash
bun run build
```

Expected: `dist/index.js` and `dist/static/` created without errors.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify HonoX migration complete"
```
