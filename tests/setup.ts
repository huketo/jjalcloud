import { sql } from "drizzle-orm";
import { clearTestData, testDb } from "./helpers/db";
import { createTestAccount, isPdsHealthy } from "./helpers/pds";

async function setup() {
	console.log("[setup] Checking PostgreSQL...");
	try {
		await testDb.execute(sql`SELECT 1`);
		console.log("[setup] PostgreSQL connected.");
	} catch {
		console.error("[setup] PostgreSQL not available. Run: docker compose up -d");
		process.exit(1);
	}

	console.log("[setup] Checking PDS...");
	if (!(await isPdsHealthy())) {
		console.error("[setup] PDS not available. Run: docker compose up -d");
		process.exit(1);
	}
	console.log("[setup] PDS connected.");

	console.log("[setup] Clearing old test data...");
	await clearTestData();

	console.log("[setup] Creating test accounts...");
	const alice = await createTestAccount("alice.test");
	console.log(`[setup] alice.test created: ${alice.did}`);

	const bob = await createTestAccount("bob.test");
	console.log(`[setup] bob.test created: ${bob.did}`);

	console.log("[setup] Done!");
	process.exit(0);
}

setup().catch((e) => {
	console.error("[setup] Failed:", e);
	process.exit(1);
});
