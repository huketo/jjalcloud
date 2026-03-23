import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db/client";
import { env } from "./env";
import { startJetstream } from "./indexer/jetstream";
import { convertToVideo } from "./indexer/media";
import { existsInR2, r2Key } from "./lib/r2";
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

// Lazy video conversion endpoint (C5 fix)
app.get("/media/:author/:rkey/:variant", async (c) => {
	const { author, rkey, variant } = c.req.param();
	if (variant !== "mp4" && variant !== "tinymp4" && variant !== "webm") {
		return c.text("invalid variant", 400);
	}

	// Check if already converted in R2
	const key = r2Key(author, rkey, variant);
	if (await existsInR2(key)) {
		return c.redirect(`${env.R2_PUBLIC_URL}/${key}`);
	}

	// Convert on demand
	try {
		const url = await convertToVideo(author, rkey, variant);
		return c.redirect(url);
	} catch (e) {
		// Fallback to original GIF if conversion fails
		const originalKey = r2Key(author, rkey, "original.gif");
		return c.redirect(`${env.R2_PUBLIC_URL}/${originalKey}`);
	}
});

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
