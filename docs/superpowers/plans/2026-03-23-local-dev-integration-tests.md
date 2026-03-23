# Local Development & Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Docker Compose 기반 로컬 개발 환경(PostgreSQL 18, PDS, Garage)과 통합 테스트를 구축한다.

**Architecture:** Docker Compose로 3개 서비스(postgres, pds, garage)를 관리한다. 테스트 헬퍼가 PDS 계정 생성, DB 연결, S3 클라이언트를 추상화하고, 통합 테스트가 실제 인프라에 대해 전체 플로우를 검증한다. Wrangler는 R2 배포 관리용.

**Tech Stack:** Docker Compose, PostgreSQL 18, bluesky-social/pds, Garage (S3-compatible), Wrangler, bun:test

**Spec:** `docs/superpowers/specs/2026-03-23-local-dev-integration-tests-design.md`

---

## File Structure

```
docker-compose.yml              # PostgreSQL 18 + PDS + Garage
scripts/
├── garage-init.sh              # Garage layout + bucket + API key 초기화
└── init-db.sh                  # DB migration + search setup 적용
wrangler.toml                   # R2 bucket 바인딩, 배포 설정
.env.test                       # 통합 테스트 환경 변수
tests/
├── setup.ts                    # 환경 연결 확인, PDS 계정 seed, Garage bucket 확인
├── teardown.ts                 # DB 정리
├── helpers/
│   ├── pds.ts                  # PDS 계정 생성, 레코드 작성 헬퍼
│   ├── db.ts                   # 테스트 DB 클라이언트
│   └── s3.ts                   # Garage S3 클라이언트
├── integration/
│   ├── gif-lifecycle.test.ts   # 업로드 → 인덱싱 → 검색 → 조회
│   ├── like-trending.test.ts   # 좋아요 → 공유 → trending
│   ├── media.test.ts           # Garage 캐싱, URL 생성
│   ├── tenor-api.test.ts       # Tenor 전체 엔드포인트 (실제 DB)
│   └── xrpc.test.ts            # XRPC 쿼리 (실제 DB)
package.json                    # scripts 추가
```

---

## Task 1: Docker Compose

**Files:**
- Create: `docker-compose.yml`, `scripts/init-db.sh`, `scripts/garage-init.sh`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:18-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: jjalcloud
      POSTGRES_PASSWORD: jjalcloud
      POSTGRES_DB: jjalcloud_test
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
      - ./src/db/migrations:/migrations
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jjalcloud"]
      interval: 5s
      timeout: 5s
      retries: 5

  pds:
    image: ghcr.io/bluesky-social/pds:0.4
    ports:
      - "2583:2583"
    environment:
      PDS_DEV_MODE: "true"
      PDS_PORT: "2583"
      PDS_HOSTNAME: localhost
      PDS_DATA_DIRECTORY: /pds/data
      PDS_BLOBSTORE_DISK_LOCATION: /pds/blocks
      PDS_ADMIN_PASSWORD: admin-pass
      PDS_JWT_SECRET: jwt-secret-for-dev-only
      PDS_SERVICE_HANDLE_DOMAINS: .test
      PDS_INVITE_REQUIRED: "false"
      PDS_DISABLE_SSRF_PROTECTION: "true"
      PDS_DID_PLC_URL: https://plc.directory
      PDS_BSKY_APP_VIEW_URL: https://api.bsky.app
      PDS_BSKY_APP_VIEW_DID: did:web:api.bsky.app
      PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    volumes:
      - pdsdata:/pds
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:2583/xrpc/_health"]
      interval: 5s
      timeout: 5s
      retries: 10

  garage:
    image: dxflrs/garage:v1.1.0
    ports:
      - "3900:3900"  # S3 API
      - "3902:3902"  # Admin API
    environment:
      GARAGE_ALLOW_WORLD_READABLE_BUCKETS: "true"
    volumes:
      - garagedata:/var/lib/garage/data
      - garagemeta:/var/lib/garage/meta
    command: >
      /garage server
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3902/health"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  pdsdata:
  garagedata:
  garagemeta:
```

- [ ] **Step 2: Write scripts/init-db.sh**

```bash
#!/bin/bash
set -e

# Apply Drizzle migrations
for f in /migrations/*.sql; do
  echo "Applying migration: $f"
  psql -U jjalcloud -d jjalcloud_test -f "$f"
done

echo "Database initialized."
```

- [ ] **Step 3: Write scripts/garage-init.sh**

```bash
#!/bin/bash
set -e

GARAGE_ADMIN="http://localhost:3902"

echo "Waiting for Garage..."
until wget -q --spider "$GARAGE_ADMIN/health" 2>/dev/null; do
  sleep 1
done

# Get node ID
NODE_ID=$(wget -qO- "$GARAGE_ADMIN/v1/status" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Apply layout
wget -qO- --post-data="{\"$NODE_ID\":{\"zone\":\"dc1\",\"capacity\":1073741824,\"tags\":[]}}" \
  --header="Content-Type: application/json" \
  "$GARAGE_ADMIN/v1/layout" >/dev/null

# Apply layout changes
LAYOUT_VERSION=$(wget -qO- "$GARAGE_ADMIN/v1/layout" | grep -o '"version":[0-9]*' | cut -d: -f2)
NEXT_VERSION=$((LAYOUT_VERSION + 1))
wget -qO- --post-data="{\"version\":$NEXT_VERSION}" \
  --header="Content-Type: application/json" \
  --method=POST \
  "$GARAGE_ADMIN/v1/layout/apply" >/dev/null

# Create API key
KEY_JSON=$(wget -qO- --post-data='{"name":"jjalcloud"}' \
  --header="Content-Type: application/json" \
  "$GARAGE_ADMIN/v1/key")

ACCESS_KEY=$(echo "$KEY_JSON" | grep -o '"accessKeyId":"[^"]*"' | cut -d'"' -f4)
SECRET_KEY=$(echo "$KEY_JSON" | grep -o '"secretAccessKey":"[^"]*"' | cut -d'"' -f4)

# Create bucket
wget -qO- --post-data='{"globalAlias":"jjalcloud-gifs"}' \
  --header="Content-Type: application/json" \
  "$GARAGE_ADMIN/v1/bucket" >/dev/null

# Grant key access to bucket
BUCKET_ID=$(wget -qO- "$GARAGE_ADMIN/v1/bucket?globalAlias=jjalcloud-gifs" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
wget -qO- --post-data="{\"bucketId\":\"$BUCKET_ID\",\"accessKeyId\":\"$ACCESS_KEY\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
  --header="Content-Type: application/json" \
  "$GARAGE_ADMIN/v1/bucket/allow" >/dev/null

echo ""
echo "=== Garage initialized ==="
echo "S3_ENDPOINT=http://localhost:3900"
echo "S3_ACCESS_KEY_ID=$ACCESS_KEY"
echo "S3_SECRET_ACCESS_KEY=$SECRET_KEY"
echo "S3_BUCKET=jjalcloud-gifs"
```

- [ ] **Step 4: Make scripts executable and test docker compose up**

```bash
chmod +x scripts/init-db.sh scripts/garage-init.sh
docker compose up -d
docker compose ps  # verify all 3 healthy
```

- [ ] **Step 5: Run garage-init.sh after services are up**

```bash
bash scripts/garage-init.sh
# Expected: prints S3 credentials
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml scripts/
git commit -m "feat: add Docker Compose (PostgreSQL 18, PDS, Garage)"
```

---

## Task 2: Environment & Wrangler Config

**Files:**
- Create: `.env.test`, `wrangler.toml`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write .env.test**

```
DATABASE_URL=postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test
R2_ENDPOINT=http://localhost:3900
R2_ACCESS_KEY_ID=<from garage-init output>
R2_SECRET_ACCESS_KEY=<from garage-init output>
R2_BUCKET=jjalcloud-gifs
R2_PUBLIC_URL=http://localhost:3900/jjalcloud-gifs
OAUTH_CLIENT_ID=http://localhost:3000
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
OAUTH_PRIVATE_KEY={}
PUBLIC_URL=http://localhost:3000
JETSTREAM_URLS=wss://jetstream1.us-east.bsky.network/subscribe,wss://jetstream2.us-east.bsky.network/subscribe
PDS_URL=http://localhost:2583
```

Note: `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are generated by `garage-init.sh`. Update after first run.

- [ ] **Step 2: Write wrangler.toml**

```toml
name = "jjalcloud"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "GIFS_BUCKET"
bucket_name = "jjalcloud-gifs"
```

- [ ] **Step 3: Add scripts to package.json**

Add to existing scripts:

```json
{
  "dev:infra": "docker compose up -d",
  "dev:infra:down": "docker compose down",
  "dev:seed": "bun run tests/setup.ts",
  "test:integration": "bun test tests/integration/",
  "test:setup": "bun run tests/setup.ts",
  "deploy:r2": "wrangler r2 bucket create jjalcloud-gifs"
}
```

- [ ] **Step 4: Add .env.test to .gitignore**

Append to `.gitignore`:
```
.env.test
```

Add `.env.test.example` (same content but with placeholder values) for reference.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml package.json .gitignore .env.test.example
git commit -m "feat: add wrangler config, test env, dev scripts"
```

---

## Task 3: Test Helpers

**Files:**
- Create: `tests/helpers/db.ts`, `tests/helpers/s3.ts`, `tests/helpers/pds.ts`

- [ ] **Step 1: Write tests/helpers/db.ts**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test";

const client = postgres(DATABASE_URL);
export const testDb = drizzle(client, { schema });

/** Clear all test data from tables (in FK-safe order) */
export async function clearTestData() {
	await testDb.delete(schema.shareEvents);
	await testDb.delete(schema.likes);
	await testDb.delete(schema.tags);
	await testDb.delete(schema.gifs);
	await testDb.delete(schema.categories);
	await testDb.delete(schema.oauthStates);
	await testDb.delete(schema.oauthSessions);
	await testDb.delete(schema.users);
}

/** Close DB connection */
export async function closeDb() {
	await client.end();
}
```

- [ ] **Step 2: Write tests/helpers/s3.ts**

```typescript
import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const S3_ENDPOINT = process.env.R2_ENDPOINT ?? "http://localhost:3900";
const S3_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const S3_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const S3_BUCKET = process.env.R2_BUCKET ?? "jjalcloud-gifs";

export const testS3 = new S3Client({
	region: "garage",
	endpoint: S3_ENDPOINT,
	credentials: {
		accessKeyId: S3_ACCESS_KEY,
		secretAccessKey: S3_SECRET_KEY,
	},
	forcePathStyle: true,
});

/** Check if an object exists in the test bucket */
export async function objectExists(key: string): Promise<boolean> {
	try {
		await testS3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
		return true;
	} catch {
		return false;
	}
}

/** List all objects in the test bucket */
export async function listObjects(): Promise<string[]> {
	const result = await testS3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET }));
	return result.Contents?.map((o) => o.Key!).filter(Boolean) ?? [];
}
```

- [ ] **Step 3: Write tests/helpers/pds.ts**

```typescript
const PDS_URL = process.env.PDS_URL ?? "http://localhost:2583";
const PDS_ADMIN_PASSWORD = "admin-pass";

interface TestAccount {
	did: string;
	handle: string;
	accessJwt: string;
	refreshJwt: string;
}

/** Create a test account on the local PDS */
export async function createTestAccount(handle: string, password = "test-pass-123"): Promise<TestAccount> {
	const email = `${handle.replace(".test", "")}@test.local`;

	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createAccount`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ handle, email, password }),
	});

	if (!res.ok) {
		const text = await res.text();
		// Account may already exist, try login
		if (text.includes("already") || text.includes("taken")) {
			return loginTestAccount(handle, password);
		}
		throw new Error(`Failed to create account ${handle}: ${text}`);
	}

	const data = await res.json();
	return {
		did: data.did,
		handle: data.handle,
		accessJwt: data.accessJwt,
		refreshJwt: data.refreshJwt,
	};
}

/** Login to an existing test account */
export async function loginTestAccount(identifier: string, password = "test-pass-123"): Promise<TestAccount> {
	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createSession`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ identifier, password }),
	});

	if (!res.ok) throw new Error(`Failed to login ${identifier}: ${await res.text()}`);

	const data = await res.json();
	return {
		did: data.did,
		handle: data.handle,
		accessJwt: data.accessJwt,
		refreshJwt: data.refreshJwt,
	};
}

/** Upload a blob to PDS */
export async function uploadBlob(account: TestAccount, data: Buffer, mimeType: string) {
	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.uploadBlob`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${account.accessJwt}`,
			"Content-Type": mimeType,
		},
		body: data,
	});

	if (!res.ok) throw new Error(`Failed to upload blob: ${await res.text()}`);
	return (await res.json()).blob;
}

/** Create a record on PDS */
export async function createRecord(account: TestAccount, collection: string, record: unknown, rkey?: string) {
	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.createRecord`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${account.accessJwt}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			repo: account.did,
			collection,
			rkey,
			record,
		}),
	});

	if (!res.ok) throw new Error(`Failed to create record: ${await res.text()}`);
	return res.json();
}

/** Check if PDS is healthy */
export async function isPdsHealthy(): Promise<boolean> {
	try {
		const res = await fetch(`${PDS_URL}/xrpc/_health`);
		return res.ok;
	} catch {
		return false;
	}
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/
git commit -m "feat: add test helpers (db, s3, pds)"
```

---

## Task 4: Setup & Teardown

**Files:**
- Create: `tests/setup.ts`, `tests/teardown.ts`

- [ ] **Step 1: Write tests/setup.ts**

```typescript
import { clearTestData, testDb } from "./helpers/db";
import { isPdsHealthy, createTestAccount } from "./helpers/pds";

async function setup() {
	console.log("[setup] Checking PostgreSQL...");
	try {
		await testDb.execute("SELECT 1" as any);
		console.log("[setup] PostgreSQL connected.");
	} catch (e) {
		console.error("[setup] PostgreSQL not available. Run: docker compose up -d");
		process.exit(1);
	}

	console.log("[setup] Checking PDS...");
	if (!(await isPdsHealthy())) {
		console.error("[setup] PDS not available. Run: docker compose up -d");
		process.exit(1);
	}
	console.log("[setup] PDS connected.");

	console.log("[setup] Clearing old test data...");
	await clearTestData();

	console.log("[setup] Creating test accounts...");
	const alice = await createTestAccount("alice.test");
	console.log(`[setup] alice.test created: ${alice.did}`);

	const bob = await createTestAccount("bob.test");
	console.log(`[setup] bob.test created: ${bob.did}`);

	console.log("[setup] Done!");
}

setup().catch((e) => {
	console.error("[setup] Failed:", e);
	process.exit(1);
});
```

- [ ] **Step 2: Write tests/teardown.ts**

```typescript
import { clearTestData, closeDb } from "./helpers/db";

async function teardown() {
	console.log("[teardown] Clearing test data...");
	await clearTestData();
	await closeDb();
	console.log("[teardown] Done.");
}

teardown().catch((e) => {
	console.error("[teardown] Failed:", e);
	process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add tests/setup.ts tests/teardown.ts
git commit -m "feat: add test setup and teardown scripts"
```

---

## Task 5: GIF Lifecycle Integration Test

**Files:**
- Create: `tests/integration/gif-lifecycle.test.ts`

- [ ] **Step 1: Write gif-lifecycle.test.ts**

PDS에 GIF를 업로드하고, indexer handler를 직접 호출하여 인덱싱한 후, API 응답을 검증한다.

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { clearTestData, closeDb, testDb } from "../helpers/db";
import { createTestAccount, createRecord, uploadBlob } from "../helpers/pds";
import { handleGifCreate, handleGifDelete } from "../../src/indexer/handlers";
import { gifs, tags } from "../../src/db/schema";

// Minimal 1x1 GIF
const TINY_GIF = Buffer.from(
	"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
	"base64",
);

describe("GIF lifecycle", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");
	});

	afterAll(async () => {
		await clearTestData();
		await closeDb();
	});

	it("uploads GIF to PDS and indexes it", async () => {
		// 1. Upload blob to PDS
		const blob = await uploadBlob(alice, TINY_GIF, "image/gif");
		expect(blob).toBeDefined();

		// 2. Create record on PDS
		const record = {
			$type: "com.jjalcloud.feed.gif",
			file: blob,
			title: "integration test gif",
			alt: "a test gif for integration",
			tags: ["test", "integration"],
			width: 1,
			height: 1,
			createdAt: new Date().toISOString(),
		};
		const result = await createRecord(alice, "com.jjalcloud.feed.gif", record, "test1");
		expect(result.uri).toContain("com.jjalcloud.feed.gif");

		// 3. Index via handler (simulating Jetstream)
		await handleGifCreate(testDb, result.uri, result.cid, alice.did, "test1", record as any);

		// 4. Verify in DB
		const dbGif = await testDb.query.gifs.findFirst({
			where: eq(gifs.uri, result.uri),
			with: { tags: true },
		});
		expect(dbGif).toBeDefined();
		expect(dbGif!.title).toBe("integration test gif");
		expect(dbGif!.tags).toHaveLength(2);
		expect(dbGif!.tags.map((t: any) => t.name).sort()).toEqual(["integration", "test"]);
	});

	it("deletes GIF from index", async () => {
		const uri = `at://${alice.did}/com.jjalcloud.feed.gif/test1`;

		await handleGifDelete(testDb, uri);

		const dbGif = await testDb.query.gifs.findFirst({
			where: eq(gifs.uri, uri),
		});
		expect(dbGif).toBeUndefined();

		// Tags should be cascade deleted
		const dbTags = await testDb.select().from(tags).where(eq(tags.gifUri, uri));
		expect(dbTags).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test (requires Docker)**

```bash
bun test tests/integration/gif-lifecycle.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/gif-lifecycle.test.ts
git commit -m "test: add GIF lifecycle integration test"
```

---

## Task 6: Like & Trending Integration Test

**Files:**
- Create: `tests/integration/like-trending.test.ts`

- [ ] **Step 1: Write like-trending.test.ts**

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { clearTestData, closeDb, testDb } from "../helpers/db";
import { createTestAccount } from "../helpers/pds";
import { handleGifCreate, handleLikeCreate, handleLikeDelete } from "../../src/indexer/handlers";
import { gifs, likes, shareEvents } from "../../src/db/schema";
import { getLikeCount } from "../../src/lib/search";

describe("like and trending", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;
	const gifUri = "at://did:plc:testlike/com.jjalcloud.feed.gif/like1";

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");

		// Seed a GIF for liking
		await handleGifCreate(testDb, gifUri, "bafylike", alice.did, "like1", {
			$type: "com.jjalcloud.feed.gif",
			file: { ref: { $link: "bafyblob" }, mimeType: "image/gif", size: 100 },
			title: "likeable gif",
			tags: ["like-test"],
			width: 100,
			height: 100,
			createdAt: new Date().toISOString(),
		} as any);
	});

	afterAll(async () => {
		await clearTestData();
		await closeDb();
	});

	it("creates a like and increments count", async () => {
		await handleLikeCreate(testDb, alice.did, "likerkey1", {
			$type: "com.jjalcloud.feed.like",
			subject: { uri: gifUri, cid: "bafylike" },
			createdAt: new Date().toISOString(),
		} as any);

		const count = await getLikeCount(testDb, gifUri);
		expect(count).toBe(1);
	});

	it("registers a share event", async () => {
		await testDb.insert(shareEvents).values({
			gifUri,
			clientKey: "test-client",
		});

		const events = await testDb.select().from(shareEvents).where(eq(shareEvents.gifUri, gifUri));
		expect(events.length).toBeGreaterThanOrEqual(1);
	});

	it("deletes like and decrements count", async () => {
		await handleLikeDelete(testDb, alice.did, "likerkey1");

		const count = await getLikeCount(testDb, gifUri);
		expect(count).toBe(0);
	});
});
```

- [ ] **Step 2: Run test**

```bash
bun test tests/integration/like-trending.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/like-trending.test.ts
git commit -m "test: add like & trending integration test"
```

---

## Task 7: Media Integration Test

**Files:**
- Create: `tests/integration/media.test.ts`

- [ ] **Step 1: Write media.test.ts**

Garage(S3)에 GIF 캐싱과 URL 생성을 검증한다.

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { objectExists } from "../helpers/s3";
import { cacheOriginalGif } from "../../src/indexer/media";
import { cfResizeUrl, r2Key } from "../../src/lib/r2";

describe("media pipeline", () => {
	it("builds correct R2 keys", () => {
		const key = r2Key("did:plc:media", "rk1", "original.gif");
		expect(key).toBe("gifs/did:plc:media/rk1/original.gif");
	});

	it("builds Cloudflare Image Resize URLs", () => {
		const url = cfResizeUrl("https://cdn.example.com/gifs/test/original.gif", 320);
		expect(url).toContain("cdn-cgi/image/width=320");
		expect(url).toContain("original.gif");
	});

	// This test requires Garage running
	it("caches a GIF to Garage (S3)", async () => {
		// Create a small test server that serves a GIF
		const server = Bun.serve({
			port: 0,
			fetch() {
				const gif = Buffer.from(
					"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
					"base64",
				);
				return new Response(gif, {
					headers: { "Content-Type": "image/gif" },
				});
			},
		});

		try {
			const url = await cacheOriginalGif(
				`http://localhost:${server.port}/test.gif`,
				"did:plc:mediatest",
				"media1",
			);
			expect(url).toContain("original.gif");

			// Verify object exists in Garage
			const exists = await objectExists("gifs/did:plc:mediatest/media1/original.gif");
			expect(exists).toBe(true);
		} finally {
			server.stop();
		}
	});
});
```

- [ ] **Step 2: Run test**

```bash
bun test tests/integration/media.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/media.test.ts
git commit -m "test: add media pipeline integration test"
```

---

## Task 8: Tenor API Integration Test

**Files:**
- Create: `tests/integration/tenor-api.test.ts`

- [ ] **Step 1: Write tenor-api.test.ts**

실제 DB에 데이터를 넣고 Tenor API 엔드포인트를 Hono `app.request()`로 검증한다.

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { clearTestData, closeDb, testDb } from "../helpers/db";
import { createTestAccount } from "../helpers/pds";
import { handleGifCreate } from "../../src/indexer/handlers";
import { categories } from "../../src/db/schema";
import { tenor } from "../../src/routes/tenor/index";

describe("Tenor API (integration)", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");

		// Seed GIFs
		for (let i = 1; i <= 3; i++) {
			await handleGifCreate(
				testDb,
				`at://${alice.did}/com.jjalcloud.feed.gif/tenor${i}`,
				`bafytenor${i}`,
				alice.did,
				`tenor${i}`,
				{
					$type: "com.jjalcloud.feed.gif",
					file: { ref: { $link: `bafyblob${i}` }, mimeType: "image/gif", size: 100 },
					title: `tenor test gif ${i}`,
					alt: `gif number ${i}`,
					tags: ["tenor", `tag${i}`],
					width: 480,
					height: 270,
					createdAt: new Date(Date.now() - i * 60000).toISOString(),
				} as any,
			);
		}

		// Seed a category
		await testDb.insert(categories).values({
			name: "Reactions",
			searchterm: "reaction",
			position: 0,
		});
	});

	afterAll(async () => {
		await clearTestData();
		await closeDb();
	});

	it("GET /search returns Tenor-format results", async () => {
		const res = await tenor.request("/search?q=tenor&limit=10");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.results).toBeArray();
		expect(body.results.length).toBeGreaterThan(0);

		const gif = body.results[0];
		expect(gif).toHaveProperty("id");
		expect(gif).toHaveProperty("title");
		expect(gif).toHaveProperty("media_formats");
		expect(gif.media_formats).toHaveProperty("gif");
		expect(gif.media_formats).toHaveProperty("mediumgif");
		expect(gif.media_formats).toHaveProperty("tinygif");
		expect(gif.media_formats).toHaveProperty("mp4");
	});

	it("GET /search returns empty for no match", async () => {
		const res = await tenor.request("/search?q=nonexistent_xyz");
		const body = await res.json();
		expect(body.results).toEqual([]);
	});

	it("GET /autocomplete returns tag suggestions", async () => {
		const res = await tenor.request("/autocomplete?q=ten");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.results).toBeArray();
	});

	it("GET /search_suggestions returns related tags", async () => {
		const res = await tenor.request("/search_suggestions?q=tenor");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.results).toBeArray();
	});

	it("GET /categories returns category list", async () => {
		const res = await tenor.request("/categories");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.tags).toBeArray();
		expect(body.tags.length).toBeGreaterThan(0);
		expect(body.tags[0]).toHaveProperty("searchterm");
		expect(body.tags[0]).toHaveProperty("name");
	});

	it("GET /posts returns GIFs by IDs", async () => {
		const res = await tenor.request("/posts?ids=tenor1,tenor2");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.results).toBeArray();
		expect(body.results.length).toBe(2);
	});

	it("GET /posts returns empty for no IDs", async () => {
		const res = await tenor.request("/posts");
		const body = await res.json();
		expect(body.results).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test**

```bash
bun test tests/integration/tenor-api.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/tenor-api.test.ts
git commit -m "test: add Tenor API integration test"
```

---

## Task 9: XRPC Integration Test

**Files:**
- Create: `tests/integration/xrpc.test.ts`

- [ ] **Step 1: Write xrpc.test.ts**

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { clearTestData, closeDb, testDb } from "../helpers/db";
import { createTestAccount } from "../helpers/pds";
import { handleGifCreate, handleLikeCreate } from "../../src/indexer/handlers";
import { xrpc } from "../../src/routes/xrpc/index";

describe("XRPC (integration)", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;
	const gifUri = "at://did:plc:xrpctest/com.jjalcloud.feed.gif/xrpc1";

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");

		await handleGifCreate(testDb, gifUri, "bafyxrpc", alice.did, "xrpc1", {
			$type: "com.jjalcloud.feed.gif",
			file: { ref: { $link: "bafyblob" }, mimeType: "image/gif", size: 100 },
			title: "xrpc test",
			tags: ["xrpc"],
			width: 640,
			height: 480,
			createdAt: new Date().toISOString(),
		} as any);

		await handleLikeCreate(testDb, alice.did, "xrpclike1", {
			$type: "com.jjalcloud.feed.like",
			subject: { uri: gifUri, cid: "bafyxrpc" },
			createdAt: new Date().toISOString(),
		} as any);
	});

	afterAll(async () => {
		await clearTestData();
		await closeDb();
	});

	it("getGif returns gif with likeCount", async () => {
		const res = await xrpc.request(`/xrpc/com.jjalcloud.feed.getGif?uri=${encodeURIComponent(gifUri)}`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.gif.title).toBe("xrpc test");
		expect(body.gif.likeCount).toBe(1);
	});

	it("getGif returns 400 without uri", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getGif");
		expect(res.status).toBe(400);
	});

	it("getGifs returns list with cursor", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getGifs?limit=10");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.gifs).toBeArray();
		expect(body.gifs.length).toBeGreaterThan(0);
	});

	it("searchGifs returns results", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.searchGifs?q=xrpc");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.gifs).toBeArray();
	});

	it("getFeed returns feed", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getFeed?limit=10");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.feed).toBeArray();
	});
});
```

- [ ] **Step 2: Run test**

```bash
bun test tests/integration/xrpc.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/xrpc.test.ts
git commit -m "test: add XRPC integration test"
```
