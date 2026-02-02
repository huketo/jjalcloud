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
		const { session, state } = await client.callback(params);

		const isLocal = isLocalDevelopment(c.env.PUBLIC_URL);

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
