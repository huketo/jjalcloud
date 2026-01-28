import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { createOAuthClient, createClientMetadata } from "../auth";
import type { HonoEnv } from "../auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, BSKY_PUBLIC_API } from "../constants";
import {
	isLocalDevelopment,
	getRedirectUrl,
	extractErrorMessage,
} from "../utils";

// app.bsky.actor.getProfile API 응답 타입
interface ProfileResponse {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	description?: string;
	followersCount?: number;
	followsCount?: number;
	postsCount?: number;
}

const oauth = new Hono<HonoEnv>();

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
				message: extractErrorMessage(error),
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

		const isLocal = isLocalDevelopment(c.env.PUBLIC_URL);

		// 세션 쿠키 설정 (DID 저장)
		setCookie(c, SESSION_COOKIE, session.did, {
			httpOnly: true,
			secure: !isLocal,
			sameSite: "Lax",
			maxAge: SESSION_MAX_AGE,
			path: "/",
		});

		return c.redirect(getRedirectUrl(c.env.PUBLIC_URL));
	} catch (error) {
		console.error("Callback error:", error);
		const redirectUrl = getRedirectUrl(c.env.PUBLIC_URL);
		return c.redirect(
			`${redirectUrl}?error=auth_failed&message=${encodeURIComponent(extractErrorMessage(error))}`,
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
		}
	}

	deleteCookie(c, SESSION_COOKIE, { path: "/" });

	return c.redirect(getRedirectUrl(c.env.PUBLIC_URL));
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

		const response = await session.fetchHandler(
			`${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch profile: ${response.status}`);
		}

		const profile = (await response.json()) as ProfileResponse;

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
				message: extractErrorMessage(error),
			},
			500,
		);
	}
});

export default oauth;
