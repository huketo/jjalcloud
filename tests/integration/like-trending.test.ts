import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { shareEvents } from "../../src/db/schema";
import { handleGifCreate, handleLikeCreate, handleLikeDelete } from "../../src/indexer/handlers";
import { getLikeCount } from "../../src/lib/search";
import { clearTestData, ensureUser, testDb } from "../helpers/db";
import { createTestAccount } from "../helpers/pds";

describe("like and trending", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;
	const gifUri = "at://did:plc:testlike/com.jjalcloud.feed.gif/like1";

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");
		await ensureUser(alice.did, alice.handle);

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
