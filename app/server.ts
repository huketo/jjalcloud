import { sql } from "drizzle-orm";
import { showRoutes } from "hono/dev";
import { createApp } from "honox/server";
import { db } from "./db/client";
import { startJetstream } from "./indexer/jetstream";

const app = createApp();

// Start indexer
startJetstream(db);

// Refresh trending materialized view every hour
setInterval(
	async () => {
		try {
			await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY trending_gifs`);
			console.log("[trending] Materialized view refreshed");
		} catch (e) {
			console.error("[trending] Refresh failed:", e);
		}
	},
	60 * 60 * 1000,
);

showRoutes(app);

export default app;
