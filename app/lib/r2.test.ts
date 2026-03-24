import { describe, expect, it } from "bun:test";
import { cfResizeUrl, r2Key } from "./r2";

describe("r2Key", () => {
	it("builds correct key", () => {
		expect(r2Key("did:plc:abc", "3jxk5", "original.gif")).toBe(
			"gifs/did:plc:abc/3jxk5/original.gif",
		);
	});
});

describe("cfResizeUrl", () => {
	it("builds Cloudflare Image Resizing URL", () => {
		const url = cfResizeUrl("https://cdn.jjalcloud.com/gifs/did:plc:abc/3jxk5/original.gif", 320);
		expect(url).toBe(
			"https://cdn.jjalcloud.com/cdn-cgi/image/width=320,fit=contain/gifs/did:plc:abc/3jxk5/original.gif",
		);
	});
});
