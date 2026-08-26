# Bun.WebView vs Playwright for the jjalcloud e2e suite

## Verdict

**Keep Playwright on Node.** `Bun.WebView` is real, capable, and can express even the OAuth redirect round trip — but it is labelled experimental, has no role-based locators or web-first assertions (a full rewrite of all 4 specs), and the decisive measurement is that **Playwright's test runner fails under Bun the moment a spec file contains TypeScript type syntax** (`const n: number = 1` → `AggregateError: 2 errors building`), while the identical file passes under Node. So the e2e job needs a real Node runtime in CI regardless of what the app runs on.

Option (c) "both" is not recommended now: it doubles maintenance to buy a capability Playwright already has.

---

## 1. Does the API exist?

Yes. `https://bun.sh/docs/runtime/webview` resolves (it serves a markdown alternate at `.../webview.md`) and documents a genuine automatable headless browser.

The ticket spells it `Bun.Webview`; the real name is **`Bun.WebView`** (capital V).

Quoting the page:

> `Bun.WebView` is a headless browser built into the runtime. Use it to load pages, run JavaScript inside them, simulate real user input, and capture screenshots — without Puppeteer, Playwright, or a separate browser download.

Stability label, quoted verbatim from the same page:

> This API is experimental and may change in future releases.

**Version it landed in: Bun v1.3.12**, per the release blog (https://bun.com/blog/bun-v1.3.12), whose front-matter description reads "…`Bun.WebView` headless browser automation…" and which has a dedicated section `## Bun.WebView — Headless Browser Automation`.

Confirmed present in the locally installed runtime:

```console
$ bun -e 'console.log("typeof Bun.WebView:", typeof Bun.WebView); console.log("bun", Bun.version, Bun.revision); console.log("proto:", Object.getOwnPropertyNames(Bun.WebView.prototype).sort().join(","))'
typeof Bun.WebView: function
bun 1.3.14 0d9b296af33f2b851fcbf4df3e9ec89751734ba4
proto: cdp,click,close,constructor,evaluate,goBack,goForward,loading,navigate,onNavigated,onNavigationFailed,press,reload,resize,screenshot,scroll,scrollTo,title,type,url
```

Also present in Bun 1.4.0 (the current `oven/bun:1-alpine` tag — see §5).

Backends, per the docs: `"webkit"` (macOS only, system WKWebView) and `"chrome"` (macOS/Linux/Windows, drives an installed Chrome/Chromium/Edge/Brave over the Chrome DevTools Protocol). On Linux — our CI and container target — the backend is `"chrome"`, so **a Chromium binary is still required**. The "no separate browser download" claim in the docs headline is true only on macOS.

## 2. Real automation surface vs. what this suite needs

Measured against the installed runtime, not just read off the page.

| e2e need | `Bun.WebView` | Evidence |
|---|---|---|
| Navigation | ✅ `navigate(url)`, resolves on main-frame `load` | executed, §3 |
| Follows 3xx redirects | ✅ resolves at the *final* URL | executed: `navigate("/set")` → 302 → resolved at `/` |
| Wait for navigation after a click | ❌ **no primitive** — must hand-roll a poll on `view.url`, or use the `onNavigated` callback | executed, §3 step 2 |
| Selector queries | ⚠️ CSS only, and only *implicitly* — there is no `waitForSelector`/`$`/locator object | `typeof v.waitForSelector: undefined`, `typeof v.$: undefined` |
| Role/label selectors (`getByRole`, `getByLabel`) | ❌ absent | `typeof v.getByRole: undefined` |
| Click | ✅ `click(selector)` auto-waits for actionability (attached, visible, stable, unobscured) | executed: waited **409 ms** for an element injected at 400 ms |
| Type / fill | ⚠️ `type(text)` inserts into the *already-focused* element — click first. Uses `InsertText`, so **no `keydown`/`keyup` fire** | docs, "Typing text" |
| Cookie read/write | ❌ no cookie API on the object; ✅ reachable via raw CDP on the Chrome backend only | `typeof v.cookies: undefined`; `cdp("Network.getCookies"/"Network.setCookie")` both executed OK, §3 |
| `storageState` save/restore | ❌ no equivalent; ⚠️ `dataStore: { directory }` gives a persistent profile that carries cookies across views | executed, §3 |
| Screenshots | ✅ png/jpeg/webp, blob/buffer/base64/shmem | executed: 5216-byte PNG, magic bytes correct |
| Evaluate JS in page | ✅ `evaluate(expr)` — **expression only**, JSON round-trip | docs + executed |
| Headless | ✅ and *only* headless — `headless: false` throws | docs reference table: "Only `true` is implemented; `false` throws." |
| Assertions / test runner / retries / trace / HTML report | ❌ none — it is a browser handle, not a test framework | docs silent (out of scope by design) |
| Parallelism | ⚠️ one operation per "slot" per view; a second concurrent call throws `ERR_INVALID_STATE` synchronously (does **not** queue) | docs, "Concurrency model" |

Two structural gaps matter most for *this* repo: there is **no role-based locator** and **no assertion layer**. All 4 specs are written in `getByRole` / `getByLabel` / `expect(...).toBeVisible()` style (`apps/web/e2e/smoke.spec.ts`, `authenticated.spec.ts`, `og.spec.ts`, `oauth-authenticated.oauth.spec.ts`). Every one would be rewritten against CSS selectors plus hand-rolled polling.

## 3. The decisive scenario: the OAuth redirect round trip — **it is expressible**

`apps/web/e2e/auth.oauth.setup.ts` does: `/login` → click "Continue with Bluesky" → out to an external authorization server → back to a callback → session cookie survives → `waitForURL("http://127.0.0.1:5173/")` (line 29) → `storageState` saved (line 34).

I rebuilt that shape with two separate `Bun.serve` origins (app + "external auth server"), an `HttpOnly` session cookie set on the callback's 302, and SSR that renders `Upload` vs `Login` off that cookie — then drove it with `Bun.WebView` (`/tmp/wv-oauth.ts`):

```console
$ BUN_CHROME_PATH=.../chrome-linux64/chrome bun wv-oauth.ts
app: http://127.0.0.1:46791 auth: http://127.0.0.1:36455
1. at login: http://127.0.0.1:46791/login
2. url immediately after click: http://127.0.0.1:46791/login      <-- click() did NOT wait for navigation
3. reached external auth server: http://127.0.0.1:36455/authorize?redirect_uri=...
4. back at app after callback redirect: http://127.0.0.1:46791/
5. nav html: <a href="/upload">Upload</a>
6. document.cookie (httpOnly should be hidden): ""
7. /upload url: http://127.0.0.1:46791/upload | body: Upload to the Cloud
8. CDP Network.getCookies: [{"name":"jjalcloud_session","value":"did:plc:test","domain":"127.0.0.1","path":"/","httpOnly":true,"sameSite":"Lax",...}]
9. CDP Network.setCookie: ok
```

Reading of that run:

- **The cross-origin round trip works.** It left the app origin, landed on a different origin, came back through a callback, and the `HttpOnly` session cookie survived and was honoured by SSR (steps 4, 5, 7).
- **Line 2 is the catch.** `click()` resolves after the page processes the click, *not* after the resulting navigation. There is no `waitForURL`. I had to write a polling helper:
  ```ts
  async function waitForUrl(view, pred, ms = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (pred(view.url)) return view.url; await Bun.sleep(50); }
    throw new Error(`timeout waiting for url, last=${view.url}`);
  }
  ```
  Every redirect assertion in the suite would need this. `onNavigated` is the tidier hook but still needs manual promise plumbing.
- **`seedSessionCookie()` has a replacement.** `apps/web/e2e/helpers/auth.ts:18-23` uses `context.addCookies([{ ..., httpOnly: true }])`. `Bun.WebView` has no cookie method, but `cdp("Network.setCookie", { httpOnly: true, ... })` succeeded (step 9) — **Chrome backend only**; the docs state `cdp()` throws `ERR_METHOD_NOT_IMPLEMENTED` on WebKit.
- **`storageState` has a rough replacement.** A persistent profile carries the session to a *fresh view*:
  ```console
  C1) after login, nav: <a href="/u">Upload</a>
  C2) NEW view, same dataStore dir, nav: <a href="/u">Upload</a>
  ```
  But it is a Chrome user-data-dir, not Playwright's portable JSON file. The docs warn it maps to `--user-data-dir` for the **entire Chrome process**, so "the first view's directory wins for all subsequent views" — i.e. you cannot cheaply run one logged-in and one logged-out context side by side in a single Bun process. `authenticated.spec.ts` relies on exactly that contrast (seeded vs. missing cookie).

So: **expressible, yes. Cheap, no.** It trades ~30 lines of declarative Playwright for hand-rolled navigation waits, CDP cookie calls, and a profile-directory dance.

## 4. Does Playwright actually run under Bun? — executed

Playwright's own system requirements (https://playwright.dev/docs/intro, "System requirements") list only:

> - Node.js: latest 22.x, 24.x or 26.x.

No mention of Bun. That is silence, so I measured it. Setup: `/tmp/librarian-pw-bun`, `bun add -d @playwright/test` → **1.62.1**, `bunx playwright install chromium`.

**(a) Library mode under Bun — works completely.**

```console
$ bun pw-lib.ts
runtime bun? 1.3.14
text after click: clicked
cookies: [{"name":"jjalcloud_session","value":"did:plc:x","domain":"127.0.0.1","path":"/","httpOnly":true,"sameSite":"Lax"}]
PLAYWRIGHT_LIBRARY_UNDER_BUN: OK
```

`chromium.launch()`, `newPage()`, `click()`, and even `context.addCookies()` with `httpOnly` all work when driven from a Bun script.

**(b) `bunx playwright test` does not actually use Bun.** The bin is `#!/usr/bin/env node`, so it silently hands off to Node:

```console
$ head -1 node_modules/.bin/playwright
#!/usr/bin/env node
$ bunx playwright test --reporter=list
RUNTIME_IS_BUN: false
process.versions.bun: <none>
  ✓  1 pw-probe.test.ts:3:5 › ... (111ms)
  1 passed (591ms)
```

With Node removed from `PATH`, the same command *does* fall through to Bun and passes a plain-JS spec:

```console
$ env PATH="/home/huke/.bun/bin:/usr/bin:/bin" sh -c 'command -v node || echo "node: ABSENT"; bunx playwright test plain.spec.js'
node: ABSENT
bun? 1.3.14
  1 passed (596ms)
```

**(c) The Bun-hosted runner breaks on TypeScript type syntax.** This is the finding that decides the ticket. Same file, same `tsconfig.json`, only the host runtime differs:

```console
$ bun  run node_modules/@playwright/test/cli.js test iso/typed.spec.ts --reporter=line
AggregateError: 2 errors building "/tmp/librarian-pw-bun/iso/typed.spec.ts"

$ node node_modules/@playwright/test/cli.js test iso/typed.spec.ts --reporter=line
  1 passed (573ms)
```

Per-construct, in the **entry spec file**, under the Bun-hosted runner:

| construct in spec file | result |
|---|---|
| no type syntax at all | `1 passed` |
| `const n: number = 1` | `errors building` |
| `new Map<string, number>()` | `errors building` |
| `x as any` | `errors building` |
| `satisfies` | `errors building` |
| `interface Foo {}` | `errors building` |
| `import type {...}` | `errors building` |
| `enum E { A }` | `errors building` |

One asymmetry worth recording: the repo's **current** specs happen to survive, because their type syntax lives in an imported helper rather than the spec body. Copying `smoke.spec.ts`, `authenticated.spec.ts` and `helpers/auth.ts` (which does contain `import type { BrowserContext }` and `interface SeedSessionOptions`) into the probe project:

```console
$ bun run node_modules/@playwright/test/cli.js test repospec/ --list
  repospec/authenticated.spec.ts:5:1 › authenticated UI flows › shows logged-in navigation on home
  ... Total: 5 tests in 2 files
```

So today's suite would limp along under Bun — but adding a single type annotation to any spec silently breaks collection. That is a trap, not a supported configuration.

Cause: Playwright installs its TS transform via Node's ESM loader hook — `node_modules/playwright/lib/transform/esmLoader.js:7970` calls `nodeModule.register(...)`. Bun exposes `module.register` (it is a `function` and does not throw) but does not honour the hook the way Playwright's build step needs. `[INFERENCE]` — I did not trace Bun's internals; the observable facts are the table above, plus that `Bun.build()` transpiles the same file with `success: true` and a direct `await import()` of it under Bun succeeds.

**Conclusion for §4:** Playwright *runs* under Bun in library mode, and its runner works under Bun only for type-free specs. For a TypeScript suite, **Playwright needs Node.** In practice that is free wherever Node exists — but see §5, where it is not free.

## 5. CI / Docker, against `oven/bun:1-alpine`

Measured in the actual image.

```console
$ docker run --rm --init oven/bun:1-alpine sh -c 'bun --version; command -v node; readlink -f $(command -v node)'
1.4.0
/usr/local/bun-node-fallback-bin/node
/usr/local/bin/bun
```

Three consequences:

1. **The image ships no Chrome**, so `Bun.WebView` throws out of the box:
   `THREW: Failed to spawn Chrome (set BUN_CHROME_PATH, backend.path, or install Chrome/Chromium)`
2. **`apk add chromium` fixes it, but it is not free** — and it needs container flags. Plain `apk add chromium` then `new Bun.WebView()` still failed with `error: Chrome process closed the pipe` (running as root without a sandbox). With explicit flags it works:
   ```ts
   new Bun.WebView({ backend: { type: "chrome", path: "/usr/bin/chromium",
                                argv: ["--no-sandbox", "--disable-dev-shm-usage"] } })
   ```
   ```console
   chromium installed
   === image size cost ===
   263.1M  /usr/lib/chromium
   === WebView with --no-sandbox ===
   evaluate: clicked
   screenshot bytes: 4945
   WEBVIEW_ON_ALPINE: OK
   ```
   So the "zero dependency" advantage over Playwright evaporates on Linux: **263 MB of Chromium either way.**
3. **`node` in that image is a symlink to `bun`.** That is a live trap: `#!/usr/bin/env node` resolves to Bun, so Playwright silently runs on the Bun path and reports *zero tests* for a typed spec rather than failing loudly:
   ```console
   $ docker run ... oven/bun:1-alpine sh -c 'bun add -d @playwright/test; bunx playwright test --list'
   #!/usr/bin/env node
   /usr/local/bun-node-fallback-bin/node -> /usr/local/bin/bun
   AggregateError: 2 errors building "/w/typed.spec.ts"
   Listing tests:
   Total: 0 tests in 0 files
   ```

Also note Playwright's supported OS list is "Debian 12 / 13, Ubuntu 22.04 / 24.04 / 26.04" — **Alpine is not supported**. Combined with (3): do not try to run the e2e suite inside the deploy image. Run it in CI on a Node/Debian image (or `mcr.microsoft.com/playwright`), against the app started separately. The production `oven/bun:1-alpine` image needs no browser and no Node.

## 6. What the workerd → Bun transition changes for the suite

`apps/web/playwright.config.ts:47-52` boots the app with:

```ts
webServer: { command: "pnpm dev", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI, timeout: 120000 }
```

and `apps/web/vite.config.ts` loads the `cloudflare({ configPath: "wrangler.jsonc" })` plugin — so today the app under test runs inside **workerd/miniflare**, not the deploy runtime. After the move to Bun + Hono this must boot the real Bun server instead.

- **If Playwright stays:** it is a one-line change to `webServer.command` (plus the port, if the Bun server does not listen on 5173). Playwright keeps handling process spawn, readiness polling on `url`, and teardown. Everything else in the suite is untouched, and the suite starts testing the runtime we actually ship — a strict improvement over today.
- **If WebView replaced it:** there is no `webServer` equivalent. You would hand-roll spawn + readiness + teardown. Mitigating factor: because the target server is Bun/Hono, tests can `import` the Hono app and call `Bun.serve({ port: 0, fetch: app.fetch })` in-process — which is exactly what I did in §3 and it is genuinely pleasant (ephemeral port, no port conflicts, no external process). That is the one place where WebView plus the Bun transition is *better* than the status quo.

Either way this is orthogonal to the tool choice; both need the `pnpm dev` boot replaced.

---

## Caveats

- `Bun.WebView` is **experimental** by the docs' own label; the API may change under us.
- The docs claim Bun's Chrome search falls back to "Playwright's cache (`~/.cache/ms-playwright` …) for `chrome-headless-shell`". **This did not work on this machine.** `~/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell` existed, yet `new Bun.WebView()` threw `Failed to spawn Chrome` (`code: "ERR_DLOPEN_FAILED"`, Bun 1.3.14 Linux x64). Every local run in this document required an explicit `BUN_CHROME_PATH`.
- Measurements used Bun **1.3.14** locally and Bun **1.4.0** in `oven/bun:1-alpine`; Playwright **1.62.1** (the repo pins `^1.56.0`).
- I did not test the WebKit backend — it is macOS-only and irrelevant to Linux CI. Note it would also lose `cdp()`, and with it the only cookie-seeding path.

## What this decides / does not decide

**Decides:**
- Ticket #9 itself: answer is **(a) keep Playwright on Node**. `Bun.WebView` exists and could technically carry the OAuth scenario, but it is experimental, costs a full rewrite of 4 specs into CSS selectors plus hand-rolled waits, and saves nothing on image size (263 MB of Chromium either way).
- **CI must provide a real Node runtime for the e2e job** — not the `oven/bun:1-alpine` image, whose `node` is a bun symlink that makes Playwright report 0 tests instead of failing. This is a concrete constraint on whatever CI/dev-container ticket follows.
- The Q13 decision (adopt `bun test`, keep Playwright) survives contact with the evidence. `bun test` for unit work, Playwright on Node for e2e, no overlap.

**Reshapes:**
- Whichever ticket rewires the app boot: `playwright.config.ts` `webServer.command` must stop being `pnpm dev` (workerd/miniflare) and start the real Bun/Hono server. Cheap, and it upgrades the suite from testing a runtime we are abandoning to testing the one we ship.

**Does not decide:**
- Whether to keep the 4 specs as-is, or expand e2e coverage after the transition.
- Anything about `bun test` adoption for unit tests — that was settled in Q13 and this research does not disturb it.
- Whether `Bun.WebView` is worth revisiting later. If it graduates from experimental and grows locators plus a wait-for-navigation primitive, the in-process `Bun.serve({ port: 0, fetch: app.fetch })` pattern from §3/§6 makes it genuinely attractive. Worth a re-look, not a bet today.
