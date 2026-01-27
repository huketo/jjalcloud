import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createOAuthClient } from "../auth/client";
import type { HonoEnv } from "../types";

// 세션 쿠키 이름
const SESSION_COOKIE = "jjalcloud_session";

/**
 * OAuth 세션 타입 (restore 메서드 반환 타입 추론)
 */
type OAuthSessionType = Awaited<
	ReturnType<Awaited<ReturnType<typeof createOAuthClient>>["restore"]>
>;

/**
 * 확장된 Hono 환경 타입 (세션 포함)
 */
export type AuthenticatedEnv = HonoEnv & {
	Variables: {
		session: OAuthSessionType;
		did: string;
	};
};

/**
 * 인증 필수 미들웨어
 * 로그인하지 않은 사용자는 401 에러를 반환합니다.
 */
export const requireAuth = createMiddleware<AuthenticatedEnv>(
	async (c, next) => {
		const did = getCookie(c, SESSION_COOKIE);

		if (!did) {
			return c.json(
				{ error: "Unauthorized", message: "로그인이 필요합니다." },
				401,
			);
		}

		try {
			const client = await createOAuthClient(c.env);
			const session = await client.restore(did);

			// 컨텍스트에 세션 정보 저장
			c.set("session", session);
			c.set("did", did);

			await next();
		} catch (error) {
			console.error("Session restore error:", error);
			return c.json(
				{
					error: "Session expired",
					message: "세션이 만료되었습니다. 다시 로그인해주세요.",
				},
				401,
			);
		}
	},
);

/**
 * 선택적 인증 미들웨어
 * 로그인하지 않아도 접근 가능하지만, 로그인한 경우 세션 정보를 제공합니다.
 */
export const optionalAuth = createMiddleware<AuthenticatedEnv>(
	async (c, next) => {
		const did = getCookie(c, SESSION_COOKIE);

		if (did) {
			try {
				const client = await createOAuthClient(c.env);
				const session = await client.restore(did);

				c.set("session", session);
				c.set("did", did);
			} catch (error) {
				// 세션 복원 실패해도 계속 진행
				console.error("Optional session restore error:", error);
			}
		}

		await next();
	},
);
