import { mock } from "bun:test";

// ---------------------------------------------------------------------------
// mock.module() calls are hoisted by Bun above all imports.
// process.env is set by the preload script (src/routes/tenor/test-preload.ts)
// configured in bunfig.toml, so src/env.ts parses successfully at load time.
// ---------------------------------------------------------------------------

// Mock the DB client

const mockInsertChain = {
	values: mock(() => Promise.resolve()),
};

const mockSelectChain: Record<string, unknown> = {};
mockSelectChain.from = mock(() => mockSelectChain);
mockSelectChain.where = mock(() => mockSelectChain);
mockSelectChain.orderBy = mock(() => Promise.resolve([]));
mockSelectChain.limit = mock(() => Promise.resolve([]));

const mockSelectDistinctChain: Record<string, unknown> = {};
mockSelectDistinctChain.from = mock(() => mockSelectDistinctChain);
mockSelectDistinctChain.where = mock(() => mockSelectDistinctChain);
mockSelectDistinctChain.limit = mock(() => Promise.resolve([]));

const mockDb = {
	query: {
		gifs: {
			findMany: mock(() => Promise.resolve([] as any[])),
			findFirst: mock(() => Promise.resolve(null as any)),
		},
	},
	select: mock(() => mockSelectChain),
	selectDistinct: mock(() => mockSelectDistinctChain),
	insert: mock(() => mockInsertChain),
	execute: mock(() => Promise.resolve([])),
};

mock.module("../../db/client", () => ({ db: mockDb }));

// ---------------------------------------------------------------------------
// Mock the search library so each test controls return values directly
// ---------------------------------------------------------------------------

mock.module("../../lib/search", () => ({
	searchGifs: mock(() => Promise.resolve([])),
	autocompleteTags: mock(() => Promise.resolve([])),
	searchSuggestions: mock(() => Promise.resolve([])),
	getTrending: mock(() => Promise.resolve([])),
	getFeed: mock(() => Promise.resolve([])),
	getLikeCount: mock(() => Promise.resolve(0)),
}));

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as searchLib from "../../lib/search";
import app from "./index";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const mockGif = {
	uri: "at://did:plc:test/com.jjalcloud.feed.gif/abc123",
	cid: "bafytest",
	author: "did:plc:test",
	rkey: "abc123",
	title: "test gif",
	alt: "a test gif",
	width: 480,
	height: 270,
	file: { ref: { $link: "bafyblob" }, mimeType: "image/gif" },
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	indexedAt: new Date("2026-01-01T00:00:00.000Z"),
	searchVector: null,
	tags: [
		{
			id: 1,
			gifUri: "at://did:plc:test/com.jjalcloud.feed.gif/abc123",
			name: "funny",
		},
	],
};

const mockGif2 = {
	...mockGif,
	uri: "at://did:plc:test/com.jjalcloud.feed.gif/def456",
	rkey: "def456",
	title: "second gif",
	tags: [{ id: 2, gifUri: "at://did:plc:test/com.jjalcloud.feed.gif/def456", name: "cat" }],
};

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

function resetMocks() {
	mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([]));
	mockDb.query.gifs.findFirst.mockImplementation(() => Promise.resolve(null));
	(mockSelectChain.orderBy as ReturnType<typeof mock>).mockImplementation(() =>
		Promise.resolve([]),
	);
	(mockSelectChain.limit as ReturnType<typeof mock>).mockImplementation(() => Promise.resolve([]));
	(mockSelectDistinctChain.limit as ReturnType<typeof mock>).mockImplementation(() =>
		Promise.resolve([]),
	);
	mockInsertChain.values.mockImplementation(() => Promise.resolve());
	mockDb.execute.mockImplementation(() => Promise.resolve([]));
	(searchLib.searchGifs as ReturnType<typeof mock>).mockImplementation(() => Promise.resolve([]));
	(searchLib.autocompleteTags as ReturnType<typeof mock>).mockImplementation(() =>
		Promise.resolve([]),
	);
	(searchLib.searchSuggestions as ReturnType<typeof mock>).mockImplementation(() =>
		Promise.resolve([]),
	);
	(searchLib.getTrending as ReturnType<typeof mock>).mockImplementation(() => Promise.resolve([]));
}

// ---------------------------------------------------------------------------
// GET /search
// ---------------------------------------------------------------------------

describe("GET /search", () => {
	beforeEach(resetMocks);

	it("returns Tenor-format results with media_formats", async () => {
		(searchLib.searchGifs as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve([mockGif]),
		);
		mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([mockGif]));

		const res = await app.request("/search?q=funny");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toHaveLength(1);

		const result = body.results[0];
		expect(result.id).toBe("abc123");
		expect(result.title).toBe("test gif");
		expect(result.content_description).toBe("a test gif");
		expect(result.tags).toEqual(["funny"]);
		expect(result.media_formats).toBeDefined();
		expect(result.media_formats.gif).toBeDefined();
		expect(result.media_formats.gif.url).toContain("cdn.jjalcloud.com");
		expect(result.media_formats.gif.dims).toEqual([480, 270]);
		expect(result.media_formats.mediumgif).toBeDefined();
		expect(result.media_formats.tinygif).toBeDefined();
		expect(result.media_formats.mp4).toBeDefined();
		expect(result.media_formats.mp4.url).toContain("jjalcloud.com/media/");
		expect(result.media_formats.tinymp4).toBeDefined();
		expect(result.media_formats.webm).toBeDefined();
		expect(result.url).toContain("jjalcloud.com/gif/");
		expect(result.created).toBe(Math.floor(new Date("2026-01-01T00:00:00.000Z").getTime() / 1000));
	});

	it("returns empty results for empty query string", async () => {
		const res = await app.request("/search?q=");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
		expect(body.next).toBeUndefined();
	});

	it("returns empty results when query is omitted", async () => {
		const res = await app.request("/search");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
	});

	it("passes limit parameter to searchGifs", async () => {
		(searchLib.searchGifs as ReturnType<typeof mock>).mockImplementation(
			(_db: unknown, _q: string, limit: number) => Promise.resolve([mockGif].slice(0, limit)),
		);
		mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([mockGif]));

		const res = await app.request("/search?q=test&limit=1");
		expect(res.status).toBe(200);

		expect(searchLib.searchGifs).toHaveBeenCalledWith(expect.anything(), "test", 1, undefined);
	});

	it("returns next cursor when results equal limit", async () => {
		(searchLib.searchGifs as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve([mockGif, mockGif2]),
		);
		mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([mockGif, mockGif2]));

		const res = await app.request("/search?q=test&limit=2");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toHaveLength(2);
		expect(body.next).toBeDefined();
		expect(typeof body.next).toBe("string");
	});

	it("does not return next cursor when results are fewer than limit", async () => {
		(searchLib.searchGifs as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve([mockGif]),
		);
		mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([mockGif]));

		const res = await app.request("/search?q=test&limit=20");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.next).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// GET /autocomplete
// ---------------------------------------------------------------------------

describe("GET /autocomplete", () => {
	beforeEach(resetMocks);

	it("returns tag name suggestions", async () => {
		(searchLib.autocompleteTags as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(["funny", "funnycat", "funnydog"]),
		);

		const res = await app.request("/autocomplete?q=fun");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual(["funny", "funnycat", "funnydog"]);
	});

	it("returns empty array for no matches", async () => {
		const res = await app.request("/autocomplete?q=zzznomatch");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
	});

	it("returns empty array when query is omitted", async () => {
		const res = await app.request("/autocomplete");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// GET /search_suggestions
// ---------------------------------------------------------------------------

describe("GET /search_suggestions", () => {
	beforeEach(resetMocks);

	it("returns related tag suggestions", async () => {
		(searchLib.searchSuggestions as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(["cat", "dog", "animal"]),
		);

		const res = await app.request("/search_suggestions?q=funny");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual(["cat", "dog", "animal"]);
	});

	it("returns empty array for no related tags", async () => {
		const res = await app.request("/search_suggestions?q=zzznomatch");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
	});

	it("returns empty array when query is omitted", async () => {
		const res = await app.request("/search_suggestions");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// GET /featured
// ---------------------------------------------------------------------------

describe("GET /featured", () => {
	beforeEach(resetMocks);

	it("returns trending GIFs in Tenor format", async () => {
		(searchLib.getTrending as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve([mockGif]),
		);

		const res = await app.request("/featured");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toHaveLength(1);
		expect(body.results[0].id).toBe("abc123");
		expect(body.results[0].media_formats).toBeDefined();
		expect(body.next).toBeUndefined();
	});

	it("returns empty results when no trending GIFs exist", async () => {
		const res = await app.request("/featured");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
	});

	it("passes limit parameter to getTrending", async () => {
		const res = await app.request("/featured?limit=5");
		expect(res.status).toBe(200);

		expect(searchLib.getTrending).toHaveBeenCalledWith(expect.anything(), 5);
	});
});

// ---------------------------------------------------------------------------
// GET /categories
// ---------------------------------------------------------------------------

describe("GET /categories", () => {
	beforeEach(resetMocks);

	it("returns category list with correct shape", async () => {
		const mockCategories = [
			{
				id: 1,
				name: "Funny",
				searchterm: "funny",
				imageUrl: "https://cdn.jjalcloud.com/funny.gif",
				position: 0,
			},
			{
				id: 2,
				name: "Cats",
				searchterm: "cats",
				imageUrl: "https://cdn.jjalcloud.com/cats.gif",
				position: 1,
			},
		];
		(mockSelectChain.orderBy as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(mockCategories),
		);

		const res = await app.request("/categories");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.tags).toHaveLength(2);
		expect(body.tags[0]).toEqual({
			searchterm: "funny",
			path: "/v2/search?q=funny",
			image: "https://cdn.jjalcloud.com/funny.gif",
			name: "Funny",
		});
	});

	it("returns empty tags when no categories exist", async () => {
		(mockSelectChain.orderBy as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve([]),
		);

		const res = await app.request("/categories");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.tags).toEqual([]);
	});

	it("uses empty string for image when imageUrl is null", async () => {
		const mockCategories = [
			{ id: 1, name: "Misc", searchterm: "misc", imageUrl: null, position: 0 },
		];
		(mockSelectChain.orderBy as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(mockCategories),
		);

		const res = await app.request("/categories");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.tags[0].image).toBe("");
	});
});

// ---------------------------------------------------------------------------
// GET /posts
// ---------------------------------------------------------------------------

describe("GET /posts", () => {
	beforeEach(resetMocks);

	it("returns GIFs by single rkey ID", async () => {
		mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([mockGif]));

		const res = await app.request("/posts?ids=abc123");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toHaveLength(1);
		expect(body.results[0].id).toBe("abc123");
	});

	it("returns multiple GIFs for comma-separated IDs", async () => {
		mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([mockGif, mockGif2]));

		const res = await app.request("/posts?ids=abc123,def456");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toHaveLength(2);
	});

	it("returns empty results when ids param is omitted", async () => {
		const res = await app.request("/posts");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.results).toEqual([]);
	});

	it("includes media_formats in posts results", async () => {
		mockDb.query.gifs.findMany.mockImplementation(() => Promise.resolve([mockGif]));

		const res = await app.request("/posts?ids=abc123");
		expect(res.status).toBe(200);

		const body = await res.json();
		const result = body.results[0];
		expect(result.media_formats.gif.url).toContain("cdn.jjalcloud.com");
		expect(result.media_formats.mp4.url).toContain("jjalcloud.com/media/");
	});
});

// ---------------------------------------------------------------------------
// POST /registershare
// ---------------------------------------------------------------------------

describe("POST /registershare", () => {
	beforeEach(resetMocks);

	it("records share event for valid GIF id", async () => {
		mockDb.query.gifs.findFirst.mockImplementation(() => Promise.resolve(mockGif));

		const res = await app.request("/registershare", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: "abc123", key: "myapp" }),
		});
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.status).toBe("ok");
		expect(mockInsertChain.values).toHaveBeenCalledWith({
			gifUri: mockGif.uri,
			clientKey: "myapp",
		});
	});

	it("records share event without client key (null)", async () => {
		mockDb.query.gifs.findFirst.mockImplementation(() => Promise.resolve(mockGif));

		const res = await app.request("/registershare", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: "abc123" }),
		});
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.status).toBe("ok");
		expect(mockInsertChain.values).toHaveBeenCalledWith({
			gifUri: mockGif.uri,
			clientKey: null,
		});
	});

	it("returns 400 for missing id", async () => {
		const res = await app.request("/registershare", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key: "myapp" }),
		});
		expect(res.status).toBe(400);

		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	it("returns 404 for non-existent GIF", async () => {
		mockDb.query.gifs.findFirst.mockImplementation(() => Promise.resolve(null));

		const res = await app.request("/registershare", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: "notexist" }),
		});
		expect(res.status).toBe(404);

		const body = await res.json();
		expect(body.error).toBeDefined();
	});
});
