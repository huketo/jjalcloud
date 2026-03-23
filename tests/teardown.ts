import { clearTestData, closeDb } from "./helpers/db";

async function teardown() {
	console.log("[teardown] Clearing test data...");
	await clearTestData();
	await closeDb();
	console.log("[teardown] Done.");
}

teardown().catch((e) => {
	console.error("[teardown] Failed:", e);
	process.exit(1);
});
