import { z } from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
	DATABASE_URL: z.string(),
	// Cloudflare R2
	R2_ENDPOINT: z.string(),
	R2_ACCESS_KEY_ID: z.string(),
	R2_SECRET_ACCESS_KEY: z.string(),
	R2_BUCKET: z.string(),
	R2_PUBLIC_URL: z.string(), // e.g. https://cdn.jjalcloud.com
	// OAuth
	OAUTH_CLIENT_ID: z.string(),
	OAUTH_REDIRECT_URI: z.string(),
	OAUTH_PRIVATE_KEY: z.string(), // JWK for private_key_jwt
	// Jetstream (comma-separated URLs, first is primary, rest are fallbacks)
	JETSTREAM_URLS: z
		.string()
		.default(
			"wss://jetstream1.us-east.bsky.network/subscribe,wss://jetstream2.us-east.bsky.network/subscribe,wss://jetstream1.us-west.bsky.network/subscribe,wss://jetstream2.us-west.bsky.network/subscribe",
		)
		.transform((s) => s.split(",")),
	// Public URL
	PUBLIC_URL: z.string().default("https://jjalcloud.com"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
