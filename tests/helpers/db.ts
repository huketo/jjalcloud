import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/db/schema";

const DATABASE_URL =
	process.env.DATABASE_URL ?? "postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test";

const client = postgres(DATABASE_URL);
export const testDb = drizzle(client, { schema });

/** Clear all test data from tables (in FK-safe order) */
export async function clearTestData() {
	await testDb.delete(schema.shareEvents);
	await testDb.delete(schema.likes);
	await testDb.delete(schema.tags);
	await testDb.delete(schema.gifs);
	await testDb.delete(schema.categories);
	await testDb.delete(schema.oauthStates);
	await testDb.delete(schema.oauthSessions);
	await testDb.delete(schema.users);
}

/** Close DB connection */
export async function closeDb() {
	await client.end();
}
