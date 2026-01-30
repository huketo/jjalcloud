import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createOAuthClient } from "../auth/client";
import type { HonoEnv } from "../types";
import { SESSION_COOKIE } from "../constants";

/**
 * OAuth Session Type (Infer return type of restore method)
 */
type OAuthSessionType = Awaited<
	ReturnType<Awaited<ReturnType<typeof createOAuthClient>>["restore"]>
>;

/**
 * Extended Hono Environment Type (includes session)
 */
export type AuthenticatedEnv = HonoEnv & {
	Variables: {
		session: OAuthSessionType;
		did: string;
	};
};

/**
 * Auth Required Middleware
 * Returns 401 error for unauthorized users.
 */
export const requireAuth = createMiddleware<AuthenticatedEnv>(
	async (c, next) => {
		const did = getCookie(c, SESSION_COOKIE);

		if (!did) {
			return c.json(
				{ error: "Unauthorized", message: "Login is required." },
				401,
			);
		}

		try {
			const client = await createOAuthClient(c.env);
			const session = await client.restore(did);

			// Store session info in context
			c.set("session", session);
			c.set("did", did);

			await next();
		} catch (error) {
			console.error("Session restore error:", error);
			return c.json(
				{
					error: "Session expired",
					message: "Session expired. Please login again.",
				},
				401,
			);
		}
	},
);

/**
 * Optional Auth Middleware
 * Accessible without login, but provides session info if logged in.
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
				// Proceed even if session restore fails
				console.error("Optional session restore error:", error);
			}
		}

		await next();
	},
);
