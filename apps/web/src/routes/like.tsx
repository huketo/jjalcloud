import { ok } from "@atcute/client";
import type { Did } from "@atcute/lexicons/syntax";
import { likes } from "@jjalcloud/common/db/schema";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { LIKE_COLLECTION } from "../constants";
import {
	type AuthenticatedEnv,
	optionalAuth,
	requireAuth,
} from "../middleware";
import { createRpcClient, extractErrorMessage } from "../utils";

const like = new Hono<AuthenticatedEnv>();

/**
 * Create Like (Toggle On)
 * POST /api/like
 * Body: { subject: { uri: string, cid: string } }
 */
like.post("/", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;
	const db = drizzle(c.env.jjalcloud_db);

	try {
		const body = await c.req.json();
		const { subject } = body as { subject: { uri: string; cid: string } };

		if (!subject || !subject.uri || !subject.cid) {
			return c.json({ error: "Invalid subject" }, 400);
		}

		// 1. Check if already liked in DB (Optional, but good for consistency)
		const existing = await db
			.select()
			.from(likes)
			.where(and(eq(likes.subject, subject.uri), eq(likes.author, did)))
			.get();

		if (existing) {
			return c.json({ message: "Already liked", rkey: existing.rkey });
		}

		// 2. Create Record in PDS
		const rpc = createRpcClient(session);
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
		const rkey = result.uri.split("/").pop();

		if (!rkey) {
			throw new Error("Failed to extract rkey from result uri");
		}

		// 3. Insert into D1
		await db.insert(likes).values({
			subject: subject.uri,
			author: did,
			rkey: rkey,
			createdAt: new Date(),
		});

		return c.json({
			success: true,
			uri: result.uri,
			cid: result.cid,
			rkey,
		});
	} catch (error) {
		console.error("Create Like error:", error);
		return c.json(
			{
				error: "Failed to create like",
				message: extractErrorMessage(error),
			},
			500,
		);
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
	const db = drizzle(c.env.jjalcloud_db);

	try {
		const body = await c.req.json();
		const { subject } = body as { subject: { uri: string } };

		if (!subject || !subject.uri) {
			return c.json({ error: "Invalid subject" }, 400);
		}

		// 1. Find rkey from D1
		const existing = await db
			.select()
			.from(likes)
			.where(and(eq(likes.subject, subject.uri), eq(likes.author, did)))
			.get();

		if (!existing) {
			return c.json({ error: "Like not found" }, 404);
		}

		// 2. Delete Record from PDS
		const rpc = createRpcClient(session);
		await ok(
			rpc.post("com.atproto.repo.deleteRecord", {
				input: {
					repo: did,
					collection: LIKE_COLLECTION,
					rkey: existing.rkey,
				},
			}),
		);

		// 3. Delete from D1
		await db
			.delete(likes)
			.where(and(eq(likes.subject, subject.uri), eq(likes.author, did)))
			.execute();

		return c.json({ success: true, message: "Unliked successfully" });
	} catch (error) {
		console.error("Delete Like error:", error);
		return c.json(
			{
				error: "Failed to delete like",
				message: extractErrorMessage(error),
			},
			500,
		);
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
		// 1. Get Count
		// Drizzle count is a bit verbose in SQLite currently without `count()` helper
		// const countResult = await db.select({ count: sql<number>`count(*)` }).from(likes).where(eq(likes.subject, subjectUri)).get();
		// Using raw sql or standard method
		const allLikes = await db
			.select()
			.from(likes)
			.where(eq(likes.subject, subjectUri))
			.all(); // Optimization: use count queries if possible
		const count = allLikes.length;

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
