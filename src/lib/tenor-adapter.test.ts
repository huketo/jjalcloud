import { describe, expect, it } from "bun:test";

// Set env vars before any imports that trigger env validation
process.env.R2_PUBLIC_URL = "https://cdn.jjalcloud.com";
process.env.PUBLIC_URL = "https://jjalcloud.com";
process.env.DATABASE_URL = "postgres://test";
process.env.R2_ENDPOINT = "https://r2.example.com";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_BUCKET = "test-bucket";
process.env.OAUTH_CLIENT_ID = "test-client";
process.env.OAUTH_REDIRECT_URI = "https://jjalcloud.com/oauth/callback";
process.env.OAUTH_PRIVATE_KEY = "{}";

import { toTenorGifObject } from "./tenor-adapter";

describe("toTenorGifObject", () => {
	const gif = {
		uri: "at://did:plc:abc/com.jjalcloud.feed.gif/3jxk5",
		rkey: "3jxk5",
		author: "did:plc:abc",
		title: "funny cat",
		alt: "A cat doing something funny",
		width: 480,
		height: 270,
		createdAt: new Date("2026-01-01T00:00:00Z"),
		tags: [{ name: "cat" }, { name: "funny" }],
	};

	it("maps basic fields", () => {
		const result = toTenorGifObject(gif);
		expect(result.id).toBe("3jxk5");
		expect(result.title).toBe("funny cat");
		expect(result.content_description).toBe("A cat doing something funny");
		expect(result.tags).toEqual(["cat", "funny"]);
	});

	it("maps media_formats with correct URLs", () => {
		const result = toTenorGifObject(gif);
		expect(result.media_formats.gif.url).toContain("original.gif");
		expect(result.media_formats.mediumgif.url).toContain("cdn-cgi/image/width=320");
		expect(result.media_formats.tinygif.url).toContain("cdn-cgi/image/width=220");
		expect(result.media_formats.mp4.url).toContain("/mp4");
	});

	it("calculates dimensions proportionally", () => {
		const result = toTenorGifObject(gif);
		expect(result.media_formats.gif.dims).toEqual([480, 270]);
		expect(result.media_formats.mediumgif.dims).toEqual([320, 180]);
		expect(result.media_formats.tinygif.dims).toEqual([220, 124]);
	});
});
