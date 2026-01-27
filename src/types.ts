/**
 * Cloudflare Workers 바인딩 타입 정의
 */
export interface CloudflareBindings {
	// KV 네임스페이스
	STATE_STORE: KVNamespace;
	SESSION_STORE: KVNamespace;
	DID_CACHE: KVNamespace;
	HANDLE_CACHE: KVNamespace;

	// 환경 변수
	PUBLIC_URL: string;

	// 시크릿 (wrangler secret put으로 설정)
	PRIVATE_KEY_JWK?: string;
}

/**
 * Hono Context에서 사용할 환경 타입
 */
export type HonoEnv = {
	Bindings: CloudflareBindings;
	Variables: {
		session?: {
			did: string;
			handle?: string;
		};
	};
};
