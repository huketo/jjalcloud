import { inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client";
import { gifs } from "../../db/schema";
import { parseLimit } from "../../lib/pagination";
import { autocompleteTags, searchGifs, searchSuggestions } from "../../lib/search";
import { tenorResponse, toTenorGifObject } from "../../lib/tenor-adapter";

const search = new Hono();

search.get("/search", async (c) => {
	const q = c.req.query("q") ?? "";
	const limit = parseLimit(c.req.query("limit"), 20);
	const pos = c.req.query("pos");
	if (!q) return c.json(tenorResponse([], null));

	const results = await searchGifs(db, q, limit, pos ?? undefined);
	const uris = results.map((g) => g.uri);
	const gifsWithTags = uris.length
		? await db.query.gifs.findMany({ where: inArray(gifs.uri, uris), with: { tags: true } })
		: [];
	const tenorResults = gifsWithTags.map(toTenorGifObject);
	const next =
		results.length === limit
			? (results[results.length - 1]?.createdAt.toISOString() ?? null)
			: null;
	return c.json(tenorResponse(tenorResults, next));
});

search.get("/autocomplete", async (c) => {
	const q = c.req.query("q") ?? "";
	const limit = parseLimit(c.req.query("limit"), 10);
	const results = await autocompleteTags(db, q, limit);
	return c.json({ results });
});

search.get("/search_suggestions", async (c) => {
	const q = c.req.query("q") ?? "";
	const limit = parseLimit(c.req.query("limit"), 10);
	const results = await searchSuggestions(db, q, limit);
	return c.json({ results });
});

export default search;
