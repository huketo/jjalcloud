import type { OAuthSession } from "@atcute/oauth-node-client";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { oauthClient } from "../../auth/client";
import { db } from "../../db/client";
import { likes } from "../../db/schema";
import { nextCursor, parseLimit } from "../../lib/pagination";
import { getFeed, getLikeCounts } from "../../lib/search";

type AuthEnv = { Variables: { did: string; session: OAuthSession } };

const app = new Hono<AuthEnv>();

const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	const did = getCookie(c, "did");
	if (!did) return c.json({ error: "unauthorized" }, 401);
	try {
		const session = await oauthClient.restore(did as any);
		c.set("session", session);
		c.set("did", did);
	} catch {
		return c.json({ error: "session expired" }, 401);
	}
	await next();
});

app.get("/feed", async (c) => {
	const limit = parseLimit(c.req.query("limit"), 20);
	const cursor = c.req.query("cursor");
	const results = await getFeed(db, limit, cursor ?? undefined);
	const likeCounts = await getLikeCounts(
		db,
		results.map((g) => g.uri),
	);
	const withLikes = results.map((gif) => ({
		...gif,
		likeCount: likeCounts.get(gif.uri) ?? 0,
	}));
	return c.json({ gifs: withLikes, cursor: nextCursor(results, limit) });
});

app.post("/like", requireAuth, async (c) => {
	const did = c.get("did");
	const session = c.get("session");
	const { uri, cid } = await c.req.json();
	if (!uri || !cid) return c.json({ error: "uri and cid required" }, 400);

	const rkey = Date.now().toString(36);

	const response = await session.handle("/xrpc/com.atproto.repo.createRecord", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			repo: did,
			collection: "com.jjalcloud.feed.like",
			rkey,
			record: {
				$type: "com.jjalcloud.feed.like",
				subject: { uri, cid },
				createdAt: new Date().toISOString(),
			},
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		return c.json({ error: `PDS write failed: ${text}` }, 502);
	}

	await db
		.insert(likes)
		.values({
			subject: uri,
			author: did,
			rkey,
			createdAt: new Date(),
		})
		.onConflictDoNothing();

	return c.json({ ok: true, rkey });
});

app.delete("/like", requireAuth, async (c) => {
	const did = c.get("did");
	const session = c.get("session");
	const { rkey } = await c.req.json();
	if (!rkey) return c.json({ error: "rkey required" }, 400);

	const response = await session.handle("/xrpc/com.atproto.repo.deleteRecord", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			repo: did,
			collection: "com.jjalcloud.feed.like",
			rkey,
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		return c.json({ error: `PDS delete failed: ${text}` }, 502);
	}

	await db.delete(likes).where(and(eq(likes.author, did), eq(likes.rkey, rkey)));

	return c.json({ ok: true });
});

export default app;
