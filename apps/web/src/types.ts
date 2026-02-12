/**
 * Cloudflare Workers Bindings Type Definition
 */
export interface CloudflareBindings {
	// KV Namespaces
	STATE_STORE: KVNamespace;
	SESSION_STORE: KVNamespace;
	DID_CACHE: KVNamespace;
	HANDLE_CACHE: KVNamespace;

	// Environment Variables
	PUBLIC_URL: string;

	// Secrets (Set via wrangler secret put)
	PRIVATE_KEY_JWK?: string;

	// D1 Database
	jjalcloud_db: D1Database;
}

export type OpenGraphType = "website" | "article";

export interface OpenGraphMeta {
	title: string;
	description: string;
	image: string;
	imageAlt: string;
	url: string;
	type?: OpenGraphType;
}

/**
 * Hono Environment type used in Context
 */
export type HonoEnv = {
	Bindings: CloudflareBindings;
	Variables: {
		session?: {
			did: string;
			handle?: string;
		};
		openGraph?: OpenGraphMeta;
	};
};
