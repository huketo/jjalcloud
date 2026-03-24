import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { gifs, likes, tags } from "../db/schema";

export async function searchGifs(db: Database, query: string, limit = 20, cursor?: string) {
	return db
		.select()
		.from(gifs)
		.where(
			and(
				sql`${gifs.searchVector} @@ plainto_tsquery('simple', ${query})
				OR EXISTS (
					SELECT 1 FROM tags WHERE tags.gif_uri = ${gifs.uri}
					AND tags.name ILIKE ${`%${query}%`}
				)`,
				cursor ? sql`${gifs.createdAt} < ${cursor}` : undefined,
			),
		)
		.orderBy(desc(gifs.createdAt))
		.limit(limit);
}

export async function autocompleteTags(db: Database, query: string, limit = 10): Promise<string[]> {
	const results = await db
		.selectDistinct({ name: tags.name })
		.from(tags)
		.where(sql`${tags.name} ILIKE ${`${query}%`}`)
		.limit(limit);
	return results.map((r) => r.name);
}

export async function searchSuggestions(
	db: Database,
	query: string,
	limit = 10,
): Promise<string[]> {
	const results = await db.execute(sql`
		SELECT t2.name, COUNT(*) AS cnt
		FROM tags t1
		JOIN tags t2 ON t1.gif_uri = t2.gif_uri AND t1.name != t2.name
		WHERE t1.name ILIKE ${`%${query}%`}
		GROUP BY t2.name
		ORDER BY cnt DESC
		LIMIT ${limit}
	`);
	return (results as { name: string }[]).map((r) => r.name);
}

export async function getFeed(db: Database, limit = 20, cursor?: string) {
	return db
		.select()
		.from(gifs)
		.where(cursor ? sql`${gifs.createdAt} < ${cursor}` : undefined)
		.orderBy(desc(gifs.createdAt))
		.limit(limit);
}

export async function getTrending(db: Database, limit = 20) {
	const trending = await db.execute(sql`
		SELECT uri FROM trending_gifs
		ORDER BY score DESC
		LIMIT ${limit}
	`);
	const uris = (trending as { uri: string }[]).map((r) => r.uri);
	if (uris.length === 0) return [];

	return db.query.gifs.findMany({
		where: inArray(gifs.uri, uris),
		with: { tags: true },
	});
}

export async function getLikeCount(db: Database, gifUri: string): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(likes)
		.where(eq(likes.subject, gifUri));
	return result[0]?.count ?? 0;
}

export async function getLikeCounts(db: Database, uris: string[]): Promise<Map<string, number>> {
	if (uris.length === 0) return new Map();
	const rows = await db
		.select({ subject: likes.subject, count: sql<number>`count(*)::int` })
		.from(likes)
		.where(inArray(likes.subject, uris))
		.groupBy(likes.subject);
	const map = new Map<string, number>();
	for (const row of rows) {
		map.set(row.subject, row.count);
	}
	return map;
}
