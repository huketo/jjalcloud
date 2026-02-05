import { users } from "@jjalcloud/common/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { HonoEnv } from "../auth";
import { createClientMetadata, createOAuthClient } from "../auth";
import { BSKY_PUBLIC_API, SESSION_COOKIE, SESSION_MAX_AGE } from "../constants";
import {
	extractErrorMessage,
	getRedirectUrl,
	isLocalDevelopment,
} from "../utils";

// app.bsky.actor.getProfile API response type
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
 * OAuth client metadata endpoint
 * Bluesky Authorization Server fetches client info via this URL.
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
 * Start OAuth Login
 * Redirect user to Bluesky auth page.
 */
oauth.get("/login", async (c) => {
	const handle = c.req.query("handle");

	if (!handle) {
		return c.json({ error: "Handle is required" }, 400);
	}

	try {
		const client = await createOAuthClient(c.env);

		// Create auth URL (scope uses what's defined in clientMetadata)
		const authUrl = await client.authorize(handle);

		// Redirect user to Bluesky auth page
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
 * Handle OAuth Callback
 * Endpoint redirected to after Bluesky auth.
 */
oauth.get("/callback", async (c) => {
	try {
		const client = await createOAuthClient(c.env);

		// Extract params from URL
		const params = new URLSearchParams(c.req.url.split("?")[1] || "");

		// Handle callback
		const { session } = await client.callback(params);

		const isLocal = isLocalDevelopment(c.env.PUBLIC_URL);

		// Fetch user profile to store in DB
		try {
			const profileResponse = await fetch(
				`${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.did)}`,
				{
					headers: {
						Accept: "application/json",
						"User-Agent": "jjalcloud/1.0",
					},
				},
			);

			if (profileResponse.ok) {
				const profile = (await profileResponse.json()) as ProfileResponse;

				// Save or update user in database
				const db = drizzle(c.env.jjalcloud_db, { schema: { users } });
				await db
					.insert(users)
					.values({
						did: profile.did,
						handle: profile.handle,
						displayName: profile.displayName || null,
						avatar: profile.avatar || null,
						lastLoginAt: new Date(),
					})
					.onConflictDoUpdate({
						target: users.did,
						set: {
							handle: profile.handle,
							displayName: profile.displayName || null,
							avatar: profile.avatar || null,
							lastLoginAt: new Date(),
						},
					});
			}
		} catch (profileError) {
			// Profile fetch 실패해도 로그인은 계속 진행
			console.error("Failed to fetch/save profile:", profileError);
		}

		// Set session cookie (store DID)
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
 * Logout
 * Delete session and redirect to main page.
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
 * Get current session info
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
		// Delete cookie if session restore fails
		deleteCookie(c, SESSION_COOKIE, {
			path: "/",
		});
		return c.json({ authenticated: false });
	}
});

/**
 * Get profile info
 * Fetch user profile via ATProto API.
 */
oauth.get("/profile", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);

	if (!did) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	try {
		// Verify session is still valid
		const client = await createOAuthClient(c.env);
		await client.restore(did);

		// Use regular fetch for public API (not session.fetchHandler which is for authenticated PDS requests)
		try {
			const response = await fetch(
				`${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
				{
					headers: {
						Accept: "application/json",
						"User-Agent": "jjalcloud/1.0",
					},
				},
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
			// 실패 시 DB에서 폴백 시도
			const db = drizzle(c.env.jjalcloud_db, { schema: { users } });
			try {
				const usersList = await db
					.select()
					.from(users)
					.where(eq(users.did, did))
					.all();
				const user = usersList[0];

				if (user) {
					return c.json({
						did: user.did,
						handle: user.handle,
						displayName: user.displayName || user.handle,
						avatar: user.avatar || undefined,
					});
				}
			} catch (dbErr) {
				console.error("DB fallback failed:", dbErr);
			}

			return c.json(
				{
					error: "Failed to fetch profile",
					message: extractErrorMessage(error),
				},
				500,
			);
		}
	} catch (error) {
		console.error("Session validation failed:", error);
		// 세션 복원 실패 시, 단순히 401을 리턴하기보다는
		// 쿠키를 삭제하도록 유도하거나, 상태를 명확히 해야 함.
		// SSR 상황을 고려하여 DB에 유저가 있다면 읽기 전용으로 정보를 줄 수도 있으나,
		// 보안상 '로그인 상태'로 착각하게 하는 것은 위험하므로 401 유지.
		return c.json(
			{
				error: "Session invalid or expired",
				details: extractErrorMessage(error),
			},
			401,
		);
	}
});

export default oauth;
