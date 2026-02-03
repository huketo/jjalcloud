import { Client, ClientResponseError } from "@atcute/client";
import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";

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
	statusCode: StatusCode,
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

import { BSKY_PUBLIC_API } from "../constants";

/**
 * Fetch user profile from Bluesky Public API
 */
export async function fetchProfile(did: string) {
	try {
		const response = await fetch(
			`${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
		);

		if (!response.ok) {
			console.error(`Failed to fetch profile for ${did}: ${response.status}`);
			return null;
		}

		const data = await response.json();
		return {
			did: data.did,
			handle: data.handle,
			displayName: data.displayName || data.handle,
			avatar: data.avatar,
			description: data.description,
		};
	} catch (error) {
		console.error("Fetch profile helper error:", error);
		return null;
	}
}
