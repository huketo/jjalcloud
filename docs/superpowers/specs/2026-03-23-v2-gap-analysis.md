# jjalcloud v2: Spec vs Implementation Gap Analysis

Verified: 2026-03-23
Spec: `docs/superpowers/specs/2026-03-23-jjalcloud-v2-design.md`

---

## A. Missing Features

### A1. GIF Caching on Indexing Not Triggered
**Spec:** "PDS blob -> Jetstream indexing -> R2 cache original"
**Code:** `handleGifCreate()` in `src/indexer/handlers.ts` inserts DB rows only. It never calls `cacheOriginalGif()` from `src/indexer/media.ts`. The R2 caching pipeline exists but is never invoked. Original GIFs are never fetched from PDS and cached to R2 during indexing.

### A2. Video Conversion Never Called
**Spec:** "mp4, tinymp4, webm -> ffmpeg lazy conversion on first request"
**Code:** `convertToVideo()` in `src/indexer/media.ts` exists but is never called from any route. The Tenor adapter (`src/lib/tenor-adapter.ts`) hardcodes R2 URLs for mp4/tinymp4/webm variants without checking if they exist or triggering conversion. Users get 404s for video variants.

### A3. `@atcute/xrpc-server` Not Used
**Spec:** "Use `@atcute/xrpc-server` for XRPC endpoints"
**Code:** `src/routes/xrpc/index.ts` uses plain Hono routes (`xrpc.get("/xrpc/...")`) instead of `@atcute/xrpc-server`. No lexicon validation, no XRPC error format, no subscription support.

### A4. Tenor `/featured` Missing Cursor Pagination
**Spec:** Tenor API v2 featured endpoint supports pagination via `pos` parameter.
**Code:** `src/routes/tenor/featured.ts` ignores the `pos` query param entirely. Always returns `null` for the `next` cursor. `getTrending()` also accepts no cursor parameter.

### A5. `batch.ts` Missing from Project Structure
**Spec:** Project structure lists `src/indexer/batch.ts` for batch writer.
**Code:** File does not exist. No batch writing logic anywhere in the indexer.

### A6. No `DohJsonHandleResolver` Fallback in `lib/identity.ts`
**Spec:** Uses `@atcute/identity-resolver` with DNS resolution.
**Code:** `src/auth/client.ts` imports `DohJsonHandleResolver` but only uses `NodeDnsHandleResolver`. `src/lib/identity.ts` also only uses `NodeDnsHandleResolver`. The DoH fallback for environments where DNS is unavailable is imported but never used.

---

## B. Implementation Contradicts Spec

### B1. Like Collection Name Wrong
**Spec:** Lexicon is `com.jjalcloud.feed.like` (custom lexicon).
**Code:** `src/routes/api/index.ts` lines 56-58 writes to `app.bsky.feed.like` and sets `$type: "app.bsky.feed.like"`. This writes Bluesky likes instead of jjalcloud likes. The Jetstream indexer listens for `com.jjalcloud.feed.like` events, so these PDS writes will never be indexed back.

### B2. Like Delete Uses Wrong Collection
**Spec:** Same as above.
**Code:** `src/routes/api/index.ts` line 96 deletes from `app.bsky.feed.like` instead of `com.jjalcloud.feed.like`.

### B3. OAuth Callback Sets Handle to DID
**Spec:** `users` table has `handle TEXT NOT NULL` for the user's handle.
**Code:** `src/routes/oauth/index.ts` line 26 sets `handle: did` (literally the DID string). Never resolves the actual handle or updates displayName/avatar from the user's profile.

### B4. `search_vector` Trigger Excludes Tags
**Spec:** "search_vector: PostgreSQL tsvector indexing title, alt, **tags**"
**Code:** `0001_search_setup.sql` trigger only indexes `title` and `alt` into `search_vector`. Tags are not included in the tsvector, despite the spec explicitly requiring it. The search function works around this with a separate `EXISTS` subquery on tags, but the tsvector itself is incomplete.

### B5. Tenor Search Uses `pos` but XRPC Uses `cursor`
**Spec:** Both should use cursor-based pagination.
**Code:** These are named differently (`pos` vs `cursor`) which is correct for Tenor compat, but the Tenor search cursor is based on `createdAt` ISO string while Tenor clients expect an opaque numeric position. Minor compat issue.

---

## C. Incomplete Stubs / Missing Logic

### C1. `getTrending` Returns Raw SQL Rows
**Code:** `src/lib/search.ts` line 65 returns `results as any[]` from raw SQL. No type safety, no tags included. When `toTenorGifObject()` is called on these rows in `src/routes/tenor/featured.ts`, the `tags` property is undefined, so all trending GIFs have empty tags.

### C2. Tenor `featured` Returns No Tags
**Code:** `src/routes/tenor/featured.ts` calls `getTrending(db, limit)` which returns raw rows without tags relation. The `toTenorGifObject()` call produces GIF objects with `tags: []` always.

### C3. `GifRow` Interface Missing `file` Field
**Code:** `src/lib/tenor-adapter.ts` GifRow interface does not include `file` (the BlobRef). The adapter cannot construct PDS blob URLs for the original GIF -- it constructs R2 URLs assuming the file is already cached, but caching (A1) is never triggered.

### C4. No User Profile Resolution
**Code:** OAuth callback stores DID as handle. No code ever fetches the user's `app.bsky.actor.profile` to populate `displayName` or `avatar`. The `users` table always has `displayName: null`, `avatar: null`.

### C5. No `require` Caching / Module Pattern Anti-pattern
**Code:** `src/lib/tenor-adapter.ts` and `src/lib/r2.ts` use `require("../env")` inside functions (lines 39, 4-5, 25, 39) instead of top-level ESM imports. This is a CommonJS pattern that bypasses TypeScript module resolution, creates circular dependency risk, and is an anti-pattern in a Bun ESM project.

---

## D. Security Gaps

### D1. SQL Injection in Search
**Code:** `src/lib/search.ts` line 14: `tags.name ILIKE ${'%' + query + '%'}`. While Drizzle's `sql` template tag parameterizes values, the string concatenation `%${query}%` happens before parameterization. Drizzle's tagged template should handle this safely, but the pattern is fragile. More critically, `searchSuggestions()` at line 43 uses the same pattern in raw SQL.

**Verdict:** After review, Drizzle's `sql` tagged template does parameterize interpolated values, so `${`%${query}%`}` becomes a parameterized value `$1 = '%user_input%'`. This is safe. **Not a real vulnerability.**

### D2. No CSRF Protection on Like Endpoints
**Code:** `POST /api/like` and `DELETE /api/like` check for a `did` cookie but have no CSRF token validation. The cookie is `sameSite: "Lax"` which mitigates GET-based CSRF but POST requests from other origins can still send the cookie in some scenarios (e.g., form submissions). No `Origin` header check or CSRF token.

### D3. No Rate Limiting
**Code:** No rate limiting middleware on any endpoint. The `/v2/registershare` POST endpoint is completely unauthenticated and writes to the database, enabling easy spam of `share_events`.

### D4. OAuth State Cleanup Missing
**Code:** `oauth_states` table accumulates entries forever. No TTL, no cleanup job. Each abandoned login flow leaves an orphaned state row.

### D5. Auth Middleware Uses `any` Types
**Code:** `src/routes/api/index.ts` line 11: `const requireAuth = async (c: any, next: any)`. Bypasses all Hono type checking. The `c.set("session", session)` and `c.get("session")` are untyped, risking runtime errors.

---

## E. Additional Issues Found

### E1. Trending Materialized View Refresh Before Creation
**Code:** `src/server.ts` starts `setInterval` for `REFRESH MATERIALIZED VIEW CONCURRENTLY trending_gifs` at server boot. If migration `0001_search_setup.sql` hasn't run, this will throw every hour. The error is caught but logged repeatedly.

### E2. Jetstream Error Handling Absent
**Code:** `src/indexer/jetstream.ts` has no try/catch inside the `for await` loop. A single handler error (e.g., DB constraint violation for a user FK that doesn't exist yet) will crash the entire indexer loop with no reconnection.

### E3. GIF FK to Users Blocks Indexing
**Code:** `gifs.author` has `REFERENCES users(did)`. The Jetstream indexer processes gif create events, but the author may not exist in the `users` table (they haven't logged in via OAuth). This FK constraint will cause the gif insert to fail silently (`onConflictDoNothing` won't help -- it's a FK violation, not a PK conflict).

### E4. Duplicate Identity Resolver Instances
**Code:** `src/auth/client.ts` and `src/lib/identity.ts` both create independent `CompositeDidDocumentResolver`, `NodeDnsHandleResolver`, and `LocalActorResolver` instances. Wasted memory; should share a single instance.

### E5. No Dockerfile in Repository
**Spec:** Lists `Dockerfile` in project structure for Railway deployment.
**Code:** No Dockerfile found in the repository.

---

## Summary: 20 Gaps Found

| Category | Count | Critical |
|---|---|---|
| A. Missing Features | 6 | A1, A2, A3 |
| B. Contradicts Spec | 5 | B1, B2, B3 |
| C. Incomplete Stubs | 5 | C1, C4 |
| D. Security Gaps | 5 | D2, D3 |
| E. Additional Issues | 5 | E2, E3 |

### Top 5 Critical Issues (must fix before production):
1. **B1/B2:** Like writes to wrong collection (`app.bsky.feed.like` vs `com.jjalcloud.feed.like`) -- fundamentally broken
2. **A1:** GIF caching never triggered -- media pipeline dead code
3. **E3:** FK constraint on `gifs.author -> users.did` blocks indexing of any GIF whose author hasn't OAuth'd
4. **E2:** No error handling in Jetstream loop -- one bad record kills the indexer
5. **A2:** Video conversion dead code -- mp4/webm URLs always 404
