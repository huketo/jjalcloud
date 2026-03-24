import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client";
import { gifs, shareEvents } from "../../db/schema";
import { tenorResponse, toTenorGifObject } from "../../lib/tenor-adapter";

const posts = new Hono();

posts.get("/posts", async (c) => {
	const ids = c.req.query("ids")?.split(",") ?? [];
	if (ids.length === 0) return c.json(tenorResponse([], null));
	if (ids.length > 50) return c.json({ error: "too many ids" }, 400);
	const results = await db.query.gifs.findMany({
		where: inArray(gifs.rkey, ids),
		with: { tags: true },
	});
	const tenorResults = results.map(toTenorGifObject);
	return c.json(tenorResponse(tenorResults, null));
});

posts.post("/registershare", async (c) => {
	const body = await c.req.json();
	const { id, key } = body;
	if (!id) return c.json({ error: "id required" }, 400);
	const gif = await db.query.gifs.findFirst({ where: eq(gifs.rkey, id) });
	if (!gif) return c.json({ error: "not found" }, 404);
	await db.insert(shareEvents).values({ gifUri: gif.uri, clientKey: key ?? null });
	return c.json({ status: "ok" });
});

export default posts;
