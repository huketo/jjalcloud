import { JoseKey } from "@atproto/jwk-jose";
import {
	DidCacheKV,
	HandleCacheKV,
	SessionStoreKV,
	StateStoreKV,
	WorkersOAuthClient,
} from "atproto-oauth-client-cloudflare-workers";
import type { CloudflareBindings } from "../types";
import { extractPort, isLocalDevelopment } from "../utils";

/**
 * Create OAuth client instance.
 * - Local Development: Loopback client (public client)
 * - Production: Confidential client (private_key_jwt auth)
 */
export async function createOAuthClient(
	env: CloudflareBindings,
): Promise<WorkersOAuthClient> {
	const publicUrl = env.PUBLIC_URL;
	const isLocal = isLocalDevelopment(publicUrl);

	// Load keyset only in production (Confidential client)
	const keyset = isLocal ? undefined : await loadKeyset(env);

	// Set URL for local development
	const port = isLocal ? extractPort(publicUrl || "http://localhost:5173") : "";
	// ATProto loopback client 요구사항 (RFC 8252):
	// - client_id: http://localhost?redirect_uri=...&scope=... 형식
	// - redirect_uri는 127.0.0.1 사용
	const loopbackRedirectUri = `http://127.0.0.1:${port}/oauth/callback`;
	const loopbackScope = "atproto transition:generic";

	// Loopback client_id includes redirect_uri and scope as query parameters
	const loopbackClientId = `http://localhost?${new URLSearchParams([
		["redirect_uri", loopbackRedirectUri],
		["scope", loopbackScope],
	]).toString()}`;

	const client = new WorkersOAuthClient({
		// DID Cache (Caching DID documents)
		didCache: new DidCacheKV(env.DID_CACHE),
		// Handle Cache (Caching handle -> did mapping)
		handleCache: new HandleCacheKV(env.HANDLE_CACHE, {}),
		// OAuth State Store (Store state during auth flow)
		stateStore: new StateStoreKV(env.STATE_STORE),
		// OAuth Session Store (Store authenticated sessions)
		sessionStore: new SessionStoreKV(env.SESSION_STORE),

		// Allow HTTP in local development
		allowHttp: isLocal,

		// Keyset for Confidential client (Production only)
		keyset,

		// Client 메타데이터
		clientMetadata: isLocal
			? // Loopback client for local development (RFC 8252)
				{
					// Loopback client_id includes redirect_uri and scope as query param
					client_id: loopbackClientId,
					// Use 127.0.0.1 for redirect_uri (RFC 8252)
					redirect_uris: [loopbackRedirectUri],
					grant_types: ["authorization_code", "refresh_token"],
					response_types: ["code"],
					scope: loopbackScope,
					// Public client (for local dev)
					token_endpoint_auth_method: "none",
					application_type: "native",
					dpop_bound_access_tokens: true,
				}
			: // Confidential client for production
				{
					client_id: `${publicUrl}/oauth/client-metadata.json`,
					client_name: "jjalcloud",
					client_uri: publicUrl,
					logo_uri: `${publicUrl}/logo.png`,
					tos_uri: `${publicUrl}/tos`,
					policy_uri: `${publicUrl}/privacy`,
					redirect_uris: [`${publicUrl}/oauth/callback`],
					grant_types: ["authorization_code", "refresh_token"],
					response_types: ["code"],
					scope: "atproto transition:generic",
					// Confidential client settings
					token_endpoint_auth_method: "private_key_jwt",
					token_endpoint_auth_signing_alg: "ES256",
					application_type: "web",
					dpop_bound_access_tokens: true,
				},
	});

	return client;
}

/**
 * Load keyset for Confidential client.
 * Load JWK from environment variable, or generate new one if missing.
 */
async function loadKeyset(env: CloudflareBindings): Promise<JoseKey[]> {
	if (env.PRIVATE_KEY_JWK) {
		try {
			const jwk = JSON.parse(env.PRIVATE_KEY_JWK);
			const key = await JoseKey.fromJWK(jwk);
			return [key];
		} catch (error) {
			console.error("Failed to load private key from environment:", error);
			throw new Error(
				"Invalid PRIVATE_KEY_JWK format. Please set a valid JWK.",
			);
		}
	}

	// Generate new key in dev environment (Must set env var in production)
	console.warn(
		"No PRIVATE_KEY_JWK found. Generating a new key for development. " +
			"For production, set PRIVATE_KEY_JWK using `wrangler secret put PRIVATE_KEY_JWK`",
	);

	const key = await JoseKey.generate(["ES256"]);
	console.log(
		"Generated key for development. Save this JWK for production use:",
		JSON.stringify(key.privateJwk),
	);

	return [key];
}

/**
 * For dev: Generate new ES256 key and return JWK.
 * Set this key with `wrangler secret put PRIVATE_KEY_JWK`.
 */
export async function generatePrivateKey(): Promise<{
	privateJwk: object;
	publicJwk: object;
}> {
	const key = await JoseKey.generate(["ES256"]);
	if (!key.privateJwk || !key.publicJwk) {
		throw new Error("Failed to generate key pair");
	}
	return {
		privateJwk: key.privateJwk,
		publicJwk: key.publicJwk,
	};
}

/**
 * Create client metadata.
 * Served at /.well-known/oauth-client-metadata.json endpoint.
 * (Production only - Local uses loopback client)
 */
export function createClientMetadata(
	env: CloudflareBindings,
	jwks?: { keys: readonly object[] },
) {
	const publicUrl = env.PUBLIC_URL || "";

	return {
		client_id: `${publicUrl}/oauth/client-metadata.json`,
		client_name: "jjalcloud",
		client_uri: publicUrl,
		logo_uri: `${publicUrl}/logo.png`,
		tos_uri: `${publicUrl}/tos`,
		policy_uri: `${publicUrl}/privacy`,
		redirect_uris: [`${publicUrl}/oauth/callback`],
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: "atproto transition:generic",
		token_endpoint_auth_method: "private_key_jwt",
		token_endpoint_auth_signing_alg: "ES256",
		application_type: "web",
		dpop_bound_access_tokens: true,
		// Include JWKS (public keys only)
		...(jwks && { jwks }),
	};
}
