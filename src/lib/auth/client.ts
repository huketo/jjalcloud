import { JoseKey } from "@atproto/jwk-jose";
import {
	WorkersOAuthClient,
	DidCacheKV,
	HandleCacheKV,
	StateStoreKV,
	SessionStoreKV,
} from "atproto-oauth-client-cloudflare-workers";
import type { CloudflareBindings } from "./types";

/**
 * 로컬 개발 환경인지 확인합니다.
 */
function isLocalDevelopment(publicUrl: string | undefined): boolean {
	return (
		!publicUrl ||
		publicUrl.includes("localhost") ||
		publicUrl.includes("127.0.0.1")
	);
}

/**
 * URL에서 포트 번호를 추출합니다.
 */
function extractPort(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.port || "5173";
	} catch {
		return "5173";
	}
}

/**
 * OAuth 클라이언트 인스턴스를 생성합니다.
 * - 로컬 개발: Loopback client (public client)
 * - 프로덕션: Confidential client (private_key_jwt 인증)
 */
export async function createOAuthClient(
	env: CloudflareBindings,
): Promise<WorkersOAuthClient> {
	const publicUrl = env.PUBLIC_URL;
	const isLocal = isLocalDevelopment(publicUrl);

	// 프로덕션 환경에서만 키셋 로드 (Confidential client)
	const keyset = isLocal ? undefined : await loadKeyset(env);

	// 로컬 개발용 URL 설정
	const port = isLocal
		? extractPort(publicUrl || "http://localhost:5173")
		: "";
	// ATProto loopback client 요구사항 (RFC 8252):
	// - client_id: http://localhost?redirect_uri=...&scope=... 형식
	// - redirect_uri는 127.0.0.1 사용
	const loopbackRedirectUri = `http://127.0.0.1:${port}/oauth/callback`;
	const loopbackScope = "atproto transition:generic";

	// Loopback client_id는 query parameter로 redirect_uri와 scope 포함
	const loopbackClientId = `http://localhost?${new URLSearchParams([
		["redirect_uri", loopbackRedirectUri],
		["scope", loopbackScope],
	]).toString()}`;

	const client = new WorkersOAuthClient({
		// DID 캐시 (DID 문서 캐싱)
		didCache: new DidCacheKV(env.DID_CACHE),
		// Handle 캐시 (handle -> did 매핑 캐싱)
		handleCache: new HandleCacheKV(env.HANDLE_CACHE, {}),
		// OAuth State 저장소 (인증 흐름 중 상태 저장)
		stateStore: new StateStoreKV(env.STATE_STORE),
		// OAuth Session 저장소 (인증된 세션 저장)
		sessionStore: new SessionStoreKV(env.SESSION_STORE),

		// 로컬 개발에서 HTTP 허용
		allowHttp: isLocal,

		// Confidential client를 위한 키셋 (프로덕션 전용)
		keyset,

		// Client 메타데이터
		clientMetadata: isLocal
			? // 로컬 개발용 Loopback client (RFC 8252)
				{
					// Loopback client_id에 redirect_uri와 scope가 query param으로 포함됨
					client_id: loopbackClientId,
					// redirect_uri는 127.0.0.1 사용 (RFC 8252)
					redirect_uris: [loopbackRedirectUri],
					grant_types: ["authorization_code", "refresh_token"],
					response_types: ["code"],
					scope: loopbackScope,
					// Public client (로컬 개발용)
					token_endpoint_auth_method: "none",
					application_type: "native",
					dpop_bound_access_tokens: true,
				}
			: // 프로덕션용 Confidential client
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
					// Confidential client 설정
					token_endpoint_auth_method: "private_key_jwt",
					token_endpoint_auth_signing_alg: "ES256",
					application_type: "web",
					dpop_bound_access_tokens: true,
				},
	});

	return client;
}

/**
 * Confidential client를 위한 키셋을 로드합니다.
 * 환경 변수에서 JWK를 로드하거나, 없으면 새로 생성합니다.
 */
async function loadKeyset(env: CloudflareBindings): Promise<JoseKey[]> {
	if (env.PRIVATE_KEY_JWK) {
		try {
			const jwk = JSON.parse(env.PRIVATE_KEY_JWK);
			const key = await JoseKey.fromJWK(jwk);
			return [key];
		} catch (error) {
			console.error(
				"Failed to load private key from environment:",
				error,
			);
			throw new Error(
				"Invalid PRIVATE_KEY_JWK format. Please set a valid JWK.",
			);
		}
	}

	// 개발 환경에서는 새 키 생성 (프로덕션에서는 반드시 환경 변수로 설정해야 함)
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
 * 개발용: 새 ES256 키를 생성하고 JWK를 반환합니다.
 * 이 키를 `wrangler secret put PRIVATE_KEY_JWK`로 설정하세요.
 */
export async function generatePrivateKey(): Promise<{
	privateJwk: object;
	publicJwk: object;
}> {
	const key = await JoseKey.generate(["ES256"]);
	return {
		privateJwk: key.privateJwk!,
		publicJwk: key.publicJwk!,
	};
}

/**
 * 클라이언트 메타데이터를 생성합니다.
 * /.well-known/oauth-client-metadata.json 엔드포인트에서 제공됩니다.
 * (프로덕션 전용 - 로컬 개발에서는 loopback client 사용)
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
		// JWKS 포함 (public keys만)
		...(jwks && { jwks }),
	};
}
