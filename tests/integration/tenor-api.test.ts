import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { categories } from "../../src/db/schema";
import { handleGifCreate } from "../../src/indexer/handlers";
import { tenor } from "../../src/routes/tenor/index";
import { clearTestData, ensureUser, testDb } from "../helpers/db";
import { createTestAccount } from "../helpers/pds";

describe("Tenor API (integration)", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");
		await ensureUser(alice.did, alice.handle);

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

		await testDb.insert(categories).values({
			name: "Reactions",
			searchterm: "reaction",
			position: 0,
		});
	});

	afterAll(async () => {
		await clearTestData();
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
