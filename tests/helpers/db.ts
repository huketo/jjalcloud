import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/db/schema";

const DATABASE_URL =
	process.env.DATABASE_URL ?? "postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test";

const client = postgres(DATABASE_URL);
export const testDb = drizzle(client, { schema });

/** Ensure a user exists in the users table (for FK constraint) */
export async function ensureUser(did: string, handle?: string) {
	await testDb
		.insert(schema.users)
		.values({ did, handle: handle ?? did })
		.onConflictDoNothing();
}

/** Clear all test data from tables (in FK-safe order) */
export async function clearTestData() {
	await testDb.execute(sql`DELETE FROM share_events`);
	await testDb.execute(sql`DELETE FROM likes`);
	await testDb.execute(sql`DELETE FROM tags`);
	await testDb.execute(sql`DELETE FROM gifs`);
	await testDb.execute(sql`DELETE FROM categories`);
	await testDb.execute(sql`DELETE FROM oauth_states`);
	await testDb.execute(sql`DELETE FROM oauth_sessions`);
	await testDb.execute(sql`DELETE FROM users`);
}
