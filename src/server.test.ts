import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

describe("health endpoint", () => {
	const app = new Hono();
	app.get("/health", (c) => c.json({ ok: true }));

	it("returns ok", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
