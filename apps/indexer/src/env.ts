import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	JETSTREAM_URL: z
		.string()
		.default("wss://jetstream2.us-east.bsky.network/subscribe"),
	LOG_LEVEL: z.string().default("info"),
	INDEXER_MAX_BATCH_SIZE: z.coerce.number().int().positive().default(20),
	INDEXER_FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(200),
	INDEXER_BATCH_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
	INDEXER_BATCH_RETRY_BASE_DELAY_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(250),
	LOCAL_DB_PATH: z.string().trim().min(1).optional(),
	// Cloudflare D1 (required for production)
	CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
	CLOUDFLARE_DATABASE_ID: z.string().optional(),
	CLOUDFLARE_API_TOKEN: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

// Validate production requirements
if (parsed.NODE_ENV === "production") {
	if (
		!parsed.CLOUDFLARE_ACCOUNT_ID ||
		!parsed.CLOUDFLARE_DATABASE_ID ||
		!parsed.CLOUDFLARE_API_TOKEN
	) {
		throw new Error(
			"Production mode requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_API_TOKEN",
		);
	}
}

export const env = parsed;

export const isProduction = env.NODE_ENV === "production";
