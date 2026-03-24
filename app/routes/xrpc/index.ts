import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client";
import { gifs } from "../../db/schema";
import { nextCursor, parseLimit } from "../../lib/pagination";
import { getFeed, getLikeCount, getTrending, searchGifs } from "../../lib/search";

const app = new Hono();

app.get("/com.jjalcloud.feed.getGif", async (c) => {
	const uri = c.req.query("uri");
	if (!uri) return c.json({ error: "uri required" }, 400);
	const gif = await db.query.gifs.findFirst({ where: eq(gifs.uri, uri), with: { tags: true } });
	if (!gif) return c.json({ error: "not found" }, 404);
	const likeCount = await getLikeCount(db, uri);
	return c.json({ gif: { ...gif, likeCount } });
});

app.get("/com.jjalcloud.feed.getGifs", async (c) => {
	const author = c.req.query("author");
	const limit = parseLimit(c.req.query("limit"), 50);
	const cursor = c.req.query("cursor");
	const results = await db
		.select()
		.from(gifs)
		.where(
			and(
				author ? eq(gifs.author, author) : undefined,
				cursor ? sql`${gifs.createdAt} < ${cursor}` : undefined,
			),
		)
		.orderBy(desc(gifs.createdAt))
		.limit(limit);
	return c.json({ gifs: results, cursor: nextCursor(results, limit) });
});

app.get("/com.jjalcloud.feed.searchGifs", async (c) => {
	const q = c.req.query("q");
	if (!q) return c.json({ error: "q required" }, 400);
	const limit = parseLimit(c.req.query("limit"), 25);
	const cursor = c.req.query("cursor");
	const results = await searchGifs(db, q, limit, cursor ?? undefined);
	return c.json({ gifs: results, cursor: nextCursor(results, limit) });
});

app.get("/com.jjalcloud.feed.getFeed", async (c) => {
	const limit = parseLimit(c.req.query("limit"), 50);
	const cursor = c.req.query("cursor");
	const results = await getFeed(db, limit, cursor ?? undefined);
	return c.json({ feed: results, cursor: nextCursor(results, limit) });
});

app.get("/com.jjalcloud.feed.getTrending", async (c) => {
	const limit = parseLimit(c.req.query("limit"), 50);
	const results = await getTrending(db, limit);
	return c.json({ gifs: results });
});

export default app;
