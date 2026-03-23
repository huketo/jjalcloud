import { asc } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client";
import { categories as categoriesTable } from "../../db/schema";
import { getTrending } from "../../lib/search";
import { tenorResponse, toTenorGifObject } from "../../lib/tenor-adapter";

const featured = new Hono();

featured.get("/featured", async (c) => {
	const limit = Number(c.req.query("limit") ?? 20);
	const results = await getTrending(db, limit);
	const tenorResults = results.map(toTenorGifObject);
	return c.json(tenorResponse(tenorResults, null));
});

featured.get("/categories", async (c) => {
	const rows = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.position));
	const results = rows.map((cat) => ({
		searchterm: cat.searchterm,
		path: `/v2/search?q=${encodeURIComponent(cat.searchterm)}`,
		image: cat.imageUrl ?? "",
		name: cat.name,
	}));
	return c.json({ tags: results });
});

export { featured };
