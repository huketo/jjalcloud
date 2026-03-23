import { Hono } from "hono";
import { logger } from "hono/logger";
import { env } from "./env";

const app = new Hono();

app.use("*", logger());

app.get("/health", (c) => c.json({ ok: true }));

export default {
	port: env.PORT,
	fetch: app.fetch,
};
