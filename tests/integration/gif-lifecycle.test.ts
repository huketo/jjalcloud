import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { gifs, tags } from "../../src/db/schema";
import { handleGifCreate, handleGifDelete } from "../../src/indexer/handlers";
import { clearTestData, ensureUser, testDb } from "../helpers/db";
import { createTestAccount, uploadBlob } from "../helpers/pds";

// Minimal 1x1 GIF
const TINY_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

describe("GIF lifecycle", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");
		await ensureUser(alice.did, alice.handle);
	});

	afterAll(async () => {
		await clearTestData();
	});

	it("uploads blob to PDS and indexes GIF via handler", async () => {
		// 1. Upload blob to PDS (standard atproto operation)
		const blob = await uploadBlob(alice, TINY_GIF, "image/gif");
		expect(blob).toBeDefined();

		// 2. Simulate Jetstream event: index via handler directly
		// PDS doesn't know custom lexicons, so we skip createRecord
		const uri = `at://${alice.did}/com.jjalcloud.feed.gif/test1`;
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

		await handleGifCreate(testDb, uri, "bafytest1", alice.did, "test1", record as any);

		// 3. Verify in DB
		const dbGif = await testDb.query.gifs.findFirst({
			where: eq(gifs.uri, uri),
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
