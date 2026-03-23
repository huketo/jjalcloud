import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "../../src/db/schema";

const DATABASE_URL =
	process.env.DATABASE_URL ?? "postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test";

export const testDb = drizzle(DATABASE_URL, { schema });

export async function ensureUser(did: string, handle?: string) {
	await testDb
		.insert(schema.users)
		.values({ did, handle: handle ?? did })
		.onConflictDoNothing();
}

export async function clearTestData() {
	await testDb.execute(
		sql`TRUNCATE share_events, likes, tags, gifs, categories, oauth_states, oauth_sessions, users CASCADE`,
	);
}
