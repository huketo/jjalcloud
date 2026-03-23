process.env.R2_PUBLIC_URL = "https://cdn.jjalcloud.com";
process.env.PUBLIC_URL = "https://jjalcloud.com";
process.env.DATABASE_URL = "postgres://test";
process.env.R2_ENDPOINT = "https://r2.example.com";
process.env.R2_ACCESS_KEY_ID = "test";
process.env.R2_SECRET_ACCESS_KEY = "test";
process.env.R2_BUCKET = "test";
process.env.OAUTH_CLIENT_ID = "test";
process.env.OAUTH_REDIRECT_URI = "https://jjalcloud.com/oauth/callback";
process.env.OAUTH_PRIVATE_KEY = "{}";
process.env.JETSTREAM_URL = "wss://test";

import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockGif = {
	uri: "at://did:plc:test/com.jjalcloud.feed.gif/abc123",
	cid: "bafytest",
	author: "did:plc:test",
	rkey: "abc123",
	title: "test gif",
	alt: "a test",
	width: 480,
	height: 270,
	file: {},
	createdAt: new Date("2026-01-01"),
	indexedAt: new Date("2026-01-01"),
	searchVector: null,
	tags: [{ id: 1, gifUri: "at://did:plc:test/com.jjalcloud.feed.gif/abc123", name: "funny" }],
};

const mockSearchGifs = mock(async () => [mockGif]);
const mockGetFeed = mock(async () => [mockGif]);
const mockGetTrending = mock(async () => [mockGif]);
const mockGetLikeCount = mock(async () => 42);

// Mutable flag so findFirst can simulate a miss without re-mocking
let mockFindFirstResult: typeof mockGif | null = mockGif;

mock.module("../../db/client", () => {
	const selectResult = {
		from: () => selectResult,
		where: () => selectResult,
		orderBy: () => selectResult,
		limit: () => Promise.resolve([mockGif]),
	};

	const queryGifs = {
		findFirst: async () => mockFindFirstResult,
		findMany: async () => [mockGif],
	};

	return {
		db: {
			select: () => selectResult,
			query: {
				gifs: queryGifs,
			},
		},
	};
});

mock.module("../../lib/search", () => ({
	searchGifs: mockSearchGifs,
	getFeed: mockGetFeed,
	getTrending: mockGetTrending,
	getLikeCount: mockGetLikeCount,
}));

const { xrpc } = await import("./index");

describe("com.jjalcloud.feed.getGif", () => {
	it("returns gif with likeCount", async () => {
		const res = await xrpc.request(`/xrpc/com.jjalcloud.feed.getGif?uri=${mockGif.uri}`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.gif).toBeDefined();
		expect(body.gif.uri).toBe(mockGif.uri);
		expect(body.gif.likeCount).toBe(42);
	});

	it("returns 400 without uri", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getGif");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("uri required");
	});

	it("returns 404 for non-existent gif", async () => {
		mockFindFirstResult = null;
		const res = await xrpc.request(
			"/xrpc/com.jjalcloud.feed.getGif?uri=at://did:plc:test/com.jjalcloud.feed.gif/nonexistent",
		);
		mockFindFirstResult = mockGif;
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("not found");
	});
});

describe("com.jjalcloud.feed.getGifs", () => {
	it("returns gifs list with cursor", async () => {
		// Use a limit equal to result count to trigger cursor generation
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getGifs?limit=1");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body.gifs)).toBe(true);
		// cursor should be set since results.length === limit
		expect(body.cursor).toBeDefined();
	});

	it("filters by author", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getGifs?author=did:plc:test");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body.gifs)).toBe(true);
	});
});

describe("com.jjalcloud.feed.searchGifs", () => {
	beforeEach(() => {
		mockSearchGifs.mockResolvedValue([mockGif]);
	});

	it("returns search results", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.searchGifs?q=funny");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body.gifs)).toBe(true);
		expect(mockSearchGifs).toHaveBeenCalled();
	});

	it("returns 400 without q", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.searchGifs");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("q required");
	});
});

describe("com.jjalcloud.feed.getFeed", () => {
	beforeEach(() => {
		mockGetFeed.mockResolvedValue([mockGif]);
	});

	it("returns feed with cursor", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getFeed?limit=1");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body.feed)).toBe(true);
		expect(mockGetFeed).toHaveBeenCalled();
		// cursor should be set since results.length === limit
		expect(body.cursor).toBeDefined();
	});
});

describe("com.jjalcloud.feed.getTrending", () => {
	beforeEach(() => {
		mockGetTrending.mockResolvedValue([mockGif]);
	});

	it("returns trending gifs", async () => {
		const res = await xrpc.request("/xrpc/com.jjalcloud.feed.getTrending");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body.gifs)).toBe(true);
		expect(mockGetTrending).toHaveBeenCalled();
	});
});
