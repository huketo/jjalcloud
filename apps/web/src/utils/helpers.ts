import { Client, ClientResponseError } from "@atcute/client";
import type { Context } from "hono";

/**
 * Check if running in local development environment.
 */
export function isLocalDevelopment(publicUrl: string | undefined): boolean {
	return (
		!publicUrl ||
		publicUrl.includes("localhost") ||
		publicUrl.includes("127.0.0.1")
	);
}

/**
 * Extract port number from URL.
 */
export function extractPort(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.port || "5173";
	} catch {
		return "5173";
	}
}

/**
 * Generate redirect URL from environment variable.
 */
export function getRedirectUrl(publicUrl: string | undefined): string {
	const isLocal = isLocalDevelopment(publicUrl);
	return isLocal ? "http://127.0.0.1:5173" : publicUrl || "";
}

/**
 * OAuth Session Type Definition
 */
export type OAuthSession = {
	did: string;
	fetchHandler: (pathname: string, init?: RequestInit) => Promise<Response>;
};

/**
 * Helper function to create atcute Client from OAuth session
 */
export function createRpcClient(session: OAuthSession): Client {
	return new Client({
		handler: (pathname, init) => session.fetchHandler(pathname, init),
	});
}

/**
 * Extract error message.
 */
export function extractErrorMessage(error: unknown): string {
	if (error instanceof ClientResponseError) {
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "Unknown error";
}

/**
 * Create API error response.
 */
export function createErrorResponse(
	c: Context,
	statusCode: 200 | 201 | 400 | 401 | 403 | 404 | 500,
	errorType: string,
	error: unknown,
) {
	return c.json(
		{
			error: errorType,
			message: extractErrorMessage(error),
		},
		statusCode,
	);
}

/**
 * Create success response.
 */
export function createSuccessResponse<T extends Record<string, unknown>>(
	c: Context,
	data: T,
	statusCode: 200 | 201 = 200,
) {
	return c.json(data, statusCode);
}

import { users } from "@jjalcloud/common/db/schema";
import { eq } from "drizzle-orm";
import { BSKY_PUBLIC_API } from "../constants";

export interface ProfileData {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	description?: string;
	followersCount?: number;
	followsCount?: number;
	postsCount?: number;
	isFollowing?: boolean;
}

/**
 * Fetch user profile from Bluesky Public API or Fallback to DB
 */
export async function fetchProfile(
	did: string,
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle DB instance type is complex to import here
	db?: any,
): Promise<ProfileData | null> {
	// 1. Try Public API
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

		if (response.ok) {
			const data = (await response.json()) as ProfileData;
			return {
				did: data.did,
				handle: data.handle,
				displayName: data.displayName || data.handle,
				avatar: data.avatar,
				description: data.description,
				followersCount: data.followersCount,
				followsCount: data.followsCount,
				postsCount: data.postsCount,
			};
		}
	} catch {
		// Failed to fetch profile from API, will try DB fallback
	}

	// 2. Fallback to DB if db instance is provided
	if (db) {
		try {
			// drizzle-orm type safety might be tricky with 'any' db, but we try common methods
			const usersList = await db
				.select()
				.from(users)
				.where(eq(users.did, did))
				.limit(1)
				.all();

			const user = usersList[0];
			if (user) {
				return {
					did: user.did,
					handle: user.handle,
					displayName: user.displayName || user.handle,
					avatar: user.avatar || undefined,
				};
			}
		} catch {
			// DB fallback failed, return null
		}
	}

	return null;
}

export const PLACEHOLDER_PASTEL_COLORS = [
	"#f3bdbd", // Red
	"#f3e6bd", // Orange/Yellow
	"#d8f3bd", // Lime
	"#bdf3cb", // Green
	"#bdf3f3", // Cyan
	"#bdcbf3", // Blue
	"#d8bdf3", // Purple
	"#f3bde6", // Pink
] as const;

export function pickPastelColor(rkey: string): string {
	let hash = 0;
	for (let i = 0; i < rkey.length; i++) {
		hash = (hash * 31 + rkey.charCodeAt(i)) | 0;
	}
	return PLACEHOLDER_PASTEL_COLORS[
		Math.abs(hash) % PLACEHOLDER_PASTEL_COLORS.length
	];
}
