import { describe, expect, it } from "bun:test";
import { cacheOriginalGif } from "../../src/indexer/media";
import { cfResizeUrl, r2Key } from "../../src/lib/r2";
import { objectExists } from "../helpers/s3";

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

			const exists = await objectExists("gifs/did:plc:mediatest/media1/original.gif");
			expect(exists).toBe(true);
		} finally {
			server.stop();
		}
	});
});
