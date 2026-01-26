import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { createOAuthClient, createClientMetadata } from "../lib/auth";
import type { HonoEnv } from "../lib/auth";

const oauth = new Hono<HonoEnv>();

// 세션 쿠키 이름
const SESSION_COOKIE = "jjalcloud_session";

/**
 * OAuth 클라이언트 메타데이터 엔드포인트
 * Bluesky Authorization Server가 이 URL을 통해 클라이언트 정보를 가져갑니다.
 */
oauth.get("/client-metadata.json", async (c) => {
	const client = await createOAuthClient(c.env);
	const metadata = createClientMetadata(c.env, { keys: client.jwks.keys });

	return c.json(metadata, 200, {
		"Content-Type": "application/json",
		"Cache-Control": "public, max-age=3600",
	});
});

/**
 * OAuth 로그인 시작
 * 사용자를 Bluesky 인증 페이지로 리다이렉트합니다.
 */
oauth.get("/login", async (c) => {
	const handle = c.req.query("handle");

	if (!handle) {
		return c.json({ error: "Handle is required" }, 400);
	}

	try {
		const client = await createOAuthClient(c.env);

		// 인증 URL 생성 (scope는 clientMetadata에 정의된 것 사용)
		const authUrl = await client.authorize(handle);

		// 사용자를 Bluesky 인증 페이지로 리다이렉트
		return c.redirect(authUrl.toString());
	} catch (error) {
		console.error("Login error:", error);
		return c.json(
			{
				error: "Failed to start login",
				message:
					error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * OAuth 콜백 처리
 * Bluesky에서 인증 후 리다이렉트되는 엔드포인트입니다.
 */
oauth.get("/callback", async (c) => {
	try {
		const client = await createOAuthClient(c.env);

		// URL에서 파라미터 추출
		const params = new URLSearchParams(c.req.url.split("?")[1] || "");

		// 콜백 처리
		const { session, state } = await client.callback(params);

		// 로컬 개발 환경인지 확인
		const isLocal =
			!c.env.PUBLIC_URL ||
			c.env.PUBLIC_URL.includes("localhost") ||
			c.env.PUBLIC_URL.includes("127.0.0.1");

		// 세션 쿠키 설정 (DID 저장)
		setCookie(c, SESSION_COOKIE, session.did, {
			httpOnly: true,
			secure: !isLocal, // 로컬에서는 secure 비활성화
			sameSite: "Lax",
			maxAge: 60 * 60 * 24 * 7, // 7일
			path: "/",
		});

		// 메인 페이지로 리다이렉트 (로컬은 127.0.0.1 사용)
		const redirectUrl = isLocal
			? "http://127.0.0.1:5173"
			: c.env.PUBLIC_URL;
		return c.redirect(redirectUrl);
	} catch (error) {
		console.error("Callback error:", error);
		const isLocal =
			!c.env.PUBLIC_URL ||
			c.env.PUBLIC_URL.includes("localhost") ||
			c.env.PUBLIC_URL.includes("127.0.0.1");
		const redirectUrl = isLocal
			? "http://127.0.0.1:5173"
			: c.env.PUBLIC_URL;
		return c.redirect(
			`${redirectUrl}?error=auth_failed&message=${encodeURIComponent(
				error instanceof Error ? error.message : "Unknown error",
			)}`,
		);
	}
});

/**
 * 로그아웃
 * 세션을 삭제하고 메인 페이지로 리다이렉트합니다.
 */
oauth.post("/logout", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);

	if (did) {
		try {
			const client = await createOAuthClient(c.env);
			await client.revoke(did);
		} catch (error) {
			console.error("Revoke error:", error);
			// 토큰 취소 실패해도 쿠키는 삭제
		}
	}

	deleteCookie(c, SESSION_COOKIE, {
		path: "/",
	});

	const isLocal =
		!c.env.PUBLIC_URL ||
		c.env.PUBLIC_URL.includes("localhost") ||
		c.env.PUBLIC_URL.includes("127.0.0.1");
	const redirectUrl = isLocal ? "http://127.0.0.1:5173" : c.env.PUBLIC_URL;
	return c.redirect(redirectUrl);
});

/**
 * 현재 세션 정보 조회
 */
oauth.get("/session", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);

	if (!did) {
		return c.json({ authenticated: false });
	}

	try {
		const client = await createOAuthClient(c.env);
		const session = await client.restore(did);

		return c.json({
			authenticated: true,
			did: session.did,
		});
	} catch (error) {
		console.error("Session restore error:", error);
		// 세션 복원 실패시 쿠키 삭제
		deleteCookie(c, SESSION_COOKIE, {
			path: "/",
		});
		return c.json({ authenticated: false });
	}
});

/**
 * 프로필 정보 조회
 * ATProto API를 통해 사용자 프로필을 가져옵니다.
 */
oauth.get("/profile", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);

	if (!did) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	try {
		const client = await createOAuthClient(c.env);
		const session = await client.restore(did);

		// ATProto API로 프로필 정보 가져오기
		const response = await session.fetchHandler(
			`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch profile: ${response.status}`);
		}

		const profile = await response.json();

		return c.json({
			did: profile.did,
			handle: profile.handle,
			displayName: profile.displayName || profile.handle,
			avatar: profile.avatar,
			description: profile.description,
			followersCount: profile.followersCount,
			followsCount: profile.followsCount,
			postsCount: profile.postsCount,
		});
	} catch (error) {
		console.error("Profile fetch error:", error);
		return c.json(
			{
				error: "Failed to fetch profile",
				message:
					error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

export default oauth;
