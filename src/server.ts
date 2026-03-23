import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db/client";
import { env } from "./env";
import { startJetstream } from "./indexer/jetstream";
import { api } from "./routes/api/index";
import { oauth } from "./routes/oauth/index";
import { tenor } from "./routes/tenor/index";
import { web } from "./routes/web/index";
import { xrpc } from "./routes/xrpc/index";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("/v2/*", cors());
app.use("/xrpc/*", cors());

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Mount routers
app.route("/v2", tenor);
app.route("/", xrpc);
app.route("/oauth", oauth);
app.route("/api", api);
app.route("/", web);

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

console.log(`[server] jjalcloud v2 running on port ${env.PORT}`);

export default {
	port: env.PORT,
	fetch: app.fetch,
};
