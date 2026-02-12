import { gifs as gifsTable } from "@jjalcloud/common/db/schema";
import { and, desc, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { HonoEnv } from "../auth";
import { toGifViewWithAuthorFromDbRecord } from "../types/gif";
import { fetchProfile } from "../utils";

const feed = new Hono<HonoEnv>();

feed.get("/feed", async (c) => {
	const cursor = c.req.query("cursor");
	const limitParam = c.req.query("limit");
	const limit = limitParam ? Math.min(Number.parseInt(limitParam, 10), 50) : 12;
	const db = drizzle(c.env.jjalcloud_db);

	try {
		let results: (typeof gifsTable.$inferSelect)[];

		if (cursor) {
			const cursorDate = new Date(cursor);
			results = await db
				.select()
				.from(gifsTable)
				.where(lt(gifsTable.createdAt, cursorDate))
				.orderBy(desc(gifsTable.createdAt), desc(gifsTable.uri))
				.limit(limit)
				.all();
		} else {
			results = await db
				.select()
				.from(gifsTable)
				.orderBy(desc(gifsTable.createdAt), desc(gifsTable.uri))
				.limit(limit)
				.all();
		}

		const uniqueDids = [...new Set(results.map((g) => g.author))];
		const profiles = new Map<
			string,
			{ handle?: string; avatar?: string; displayName?: string }
		>();

		await Promise.all(
			uniqueDids.map(async (did) => {
				const profile = await fetchProfile(did, db);
				if (profile) profiles.set(did, profile);
			}),
		);

		const gifs = results.map((g) =>
			toGifViewWithAuthorFromDbRecord(g, profiles.get(g.author)),
		);

		const nextCursor =
			results.length > 0
				? results[results.length - 1].createdAt.toISOString()
				: undefined;

		return c.json({ gifs, cursor: nextCursor });
	} catch (err) {
		console.error("Feed API Error:", err);
		return c.json({ error: "Failed to fetch feed" }, 500);
	}
});

feed.get("/search", async (c) => {
	const q = (c.req.query("q") || "").trim();
	const cursor = c.req.query("cursor");
	const limitParam = c.req.query("limit");
	const limit = limitParam ? Math.min(Number.parseInt(limitParam, 10), 50) : 12;

	if (!q) {
		return c.json({ gifs: [], cursor: undefined });
	}

	const db = drizzle(c.env.jjalcloud_db);
	const likePattern = `%${q}%`;

	try {
		const searchCondition = or(
			sql`lower(coalesce(${gifsTable.title}, '')) LIKE lower(${likePattern})`,
			sql`lower(coalesce(${gifsTable.alt}, '')) LIKE lower(${likePattern})`,
			sql`lower(coalesce(${gifsTable.tags}, '')) LIKE lower(${likePattern})`,
		);

		let results: (typeof gifsTable.$inferSelect)[];

		if (cursor) {
			const cursorDate = new Date(cursor);
			results = await db
				.select()
				.from(gifsTable)
				.where(and(searchCondition, lt(gifsTable.createdAt, cursorDate)))
				.orderBy(desc(gifsTable.createdAt), desc(gifsTable.uri))
				.limit(limit)
				.all();
		} else {
			results = await db
				.select()
				.from(gifsTable)
				.where(searchCondition)
				.orderBy(desc(gifsTable.createdAt), desc(gifsTable.uri))
				.limit(limit)
				.all();
		}

		const uniqueDids = [...new Set(results.map((g) => g.author))];
		const profiles = new Map<
			string,
			{ handle?: string; avatar?: string; displayName?: string }
		>();

		await Promise.all(
			uniqueDids.map(async (did) => {
				const profile = await fetchProfile(did, db);
				if (profile) profiles.set(did, profile);
			}),
		);

		const gifs = results.map((g) =>
			toGifViewWithAuthorFromDbRecord(g, profiles.get(g.author)),
		);

		const nextCursor =
			results.length > 0
				? results[results.length - 1].createdAt.toISOString()
				: undefined;

		return c.json({ gifs, cursor: nextCursor });
	} catch (err) {
		console.error("Search API Error:", err);
		return c.json({ error: "Failed to search gifs" }, 500);
	}
});

export default feed;
