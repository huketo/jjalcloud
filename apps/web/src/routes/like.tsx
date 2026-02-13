import { ok } from "@atcute/client";
import type { Did } from "@atcute/lexicons/syntax";
import { likes } from "@jjalcloud/common/db/schema";
import type { Record as LikeRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/like";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { LIKE_COLLECTION } from "../constants";
import {
	type AuthenticatedEnv,
	optionalAuth,
	requireAuth,
} from "../middleware";
import { createErrorResponse, createRpcClient } from "../utils";

const like = new Hono<AuthenticatedEnv>();

function extractRkeyFromUri(uri: string): string | null {
	const rkey = uri.split("/").pop();
	return rkey || null;
}

async function findLikeRkeysBySubject(
	rpc: ReturnType<typeof createRpcClient>,
	did: Did,
	subjectUri: string,
	maxMatches = Number.POSITIVE_INFINITY,
): Promise<string[]> {
	let cursor: string | undefined;
	const rkeys: string[] = [];

	do {
		const data = await ok(
			rpc.get("com.atproto.repo.listRecords", {
				params: {
					repo: did,
					collection: LIKE_COLLECTION,
					limit: 100,
					cursor,
				},
			}),
		);

		for (const record of data.records) {
			const value = record.value as unknown as LikeRecord;
			if (value.subject?.uri !== subjectUri) {
				continue;
			}

			const rkey = extractRkeyFromUri(record.uri);
			if (!rkey) {
				continue;
			}

			rkeys.push(rkey);
			if (rkeys.length >= maxMatches) {
				return rkeys;
			}
		}

		cursor = data.cursor;
	} while (cursor);

	return rkeys;
}

/**
 * Create Like (Toggle On)
 * POST /api/like
 * Body: { subject: { uri: string, cid: string } }
 */
like.post("/", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;

	try {
		const body = await c.req.json();
		const { subject } = body as { subject: { uri: string; cid: string } };

		if (!subject || !subject.uri || !subject.cid) {
			return c.json({ error: "Invalid subject" }, 400);
		}

		const rpc = createRpcClient(session);
		const existingRkeys = await findLikeRkeysBySubject(
			rpc,
			did,
			subject.uri,
			1,
		);

		if (existingRkeys.length > 0) {
			return c.json({ message: "Already liked", rkey: existingRkeys[0] });
		}

		// 2. Create Record in PDS
		const record = {
			$type: LIKE_COLLECTION,
			subject: {
				uri: subject.uri,
				cid: subject.cid,
			},
			createdAt: new Date().toISOString(),
		};

		const result = await ok(
			rpc.post("com.atproto.repo.createRecord", {
				input: {
					repo: did,
					collection: LIKE_COLLECTION,
					record,
				},
			}),
		);

		// Extract rkey from uri
		const rkey = extractRkeyFromUri(result.uri);

		if (!rkey) {
			throw new Error("Failed to extract rkey from result uri");
		}

		return c.json({
			success: true,
			uri: result.uri,
			cid: result.cid,
			rkey,
		});
	} catch (error) {
		console.error("Create Like error:", error);
		return createErrorResponse(c, 500, "Failed to create like", error);
	}
});

/**
 * Cancel Like (Toggle Off)
 * DELETE /api/like
 * Body: { subject: { uri: string } }
 */
like.delete("/", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;

	try {
		const body = await c.req.json();
		const { subject } = body as { subject: { uri: string } };

		if (!subject || !subject.uri) {
			return c.json({ error: "Invalid subject" }, 400);
		}

		const rpc = createRpcClient(session);
		const rkeys = await findLikeRkeysBySubject(rpc, did, subject.uri);

		if (rkeys.length === 0) {
			return c.json({ error: "Like not found" }, 404);
		}

		for (const rkey of rkeys) {
			await ok(
				rpc.post("com.atproto.repo.deleteRecord", {
					input: {
						repo: did,
						collection: LIKE_COLLECTION,
						rkey,
					},
				}),
			);
		}

		return c.json({ success: true, message: "Unliked successfully" });
	} catch (error) {
		console.error("Delete Like error:", error);
		return createErrorResponse(c, 500, "Failed to delete like", error);
	}
});

/**
 * Get Like status and count
 * GET /api/like?subject=...
 */
like.get("/", optionalAuth, async (c) => {
	const did = c.get("did"); // Optional
	const subjectUri = c.req.query("subject");
	const db = drizzle(c.env.jjalcloud_db);

	if (!subjectUri) {
		return c.json({ error: "Subject URI required" }, 400);
	}

	try {
		// Get like count efficiently
		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(likes)
			.where(eq(likes.subject, subjectUri))
			.get();
		const count = countResult?.count ?? 0;

		// 2. Check if User Liked
		let isLiked = false;
		if (did) {
			const userLike = await db
				.select()
				.from(likes)
				.where(and(eq(likes.subject, subjectUri), eq(likes.author, did)))
				.get();
			isLiked = !!userLike;
		}

		return c.json({ count, isLiked });
	} catch (error) {
		console.error("Get Like Info error:", error);
		return c.json({ count: 0, isLiked: false }, 200); // Fail gracefully for UI
	}
});

export default like;
