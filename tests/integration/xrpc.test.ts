import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { handleGifCreate, handleLikeCreate } from "../../src/indexer/handlers";
import { xrpc } from "../../src/routes/xrpc/index";
import { clearTestData, ensureUser, testDb } from "../helpers/db";
import { createTestAccount } from "../helpers/pds";

describe("XRPC (integration)", () => {
	let alice: Awaited<ReturnType<typeof createTestAccount>>;
	const gifUri = "at://did:plc:xrpctest/com.jjalcloud.feed.gif/xrpc1";

	beforeAll(async () => {
		await clearTestData();
		alice = await createTestAccount("alice.test");
		await ensureUser(alice.did, alice.handle);

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
	});

	it("getGif returns gif with likeCount", async () => {
		const res = await xrpc.request(
			`/xrpc/com.jjalcloud.feed.getGif?uri=${encodeURIComponent(gifUri)}`,
		);
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
