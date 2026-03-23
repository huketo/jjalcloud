import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { gifs, tags } from "../../src/db/schema";
import { handleGifCreate, handleGifDelete } from "../../src/indexer/handlers";
import { clearTestData, closeDb, testDb } from "../helpers/db";
import { createRecord, createTestAccount, uploadBlob } from "../helpers/pds";

// Minimal 1x1 GIF
const TINY_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

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
		const blob = await uploadBlob(alice, TINY_GIF, "image/gif");
		expect(blob).toBeDefined();

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

		// Index via handler (simulating Jetstream)
		await handleGifCreate(testDb, result.uri, result.cid, alice.did, "test1", record as any);

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

		const dbTags = await testDb.select().from(tags).where(eq(tags.gifUri, uri));
		expect(dbTags).toHaveLength(0);
	});
});
