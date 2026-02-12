import type {} from "@atcute/atproto";
import { ClientResponseError, ok } from "@atcute/client";
import type { Did } from "@atcute/lexicons/syntax";
import { TID } from "@atproto/common-web";
import { gifs as gifsTable, likes } from "@jjalcloud/common/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
	GIF_COLLECTION,
	MAX_GIF_SIZE,
	MAX_TAGS_COUNT,
	SESSION_COOKIE,
} from "../constants";
import { type AuthenticatedEnv, requireAuth } from "../middleware";
import {
	type GifRecord,
	parseTags,
	toGifView,
	toGifViewFromDbRecord,
} from "../types/gif";
import { createRpcClient, extractErrorMessage } from "../utils";

const gif = new Hono<AuthenticatedEnv>();

/**
 * List GIFs (My GIFs)
 * GET /api/gif
 */
gif.get("/", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;

	try {
		const rpc = createRpcClient(session);

		const data = await ok(
			rpc.get("com.atproto.repo.listRecords", {
				params: {
					repo: did,
					collection: GIF_COLLECTION,
					limit: 50,
				},
			}),
		);

		const gifs = data.records.map(toGifView);

		// Enrich with likes
		if (gifs.length > 0) {
			const db = drizzle(c.env.jjalcloud_db);
			const uris = gifs.map((g) => g.uri);

			// Get like counts
			const likeCounts = await db
				.select({
					subject: likes.subject,
					count: sql<number>`count(*)`,
				})
				.from(likes)
				.where(inArray(likes.subject, uris))
				.groupBy(likes.subject)
				.all();

			const likeCountMap = new Map(likeCounts.map((l) => [l.subject, l.count]));

			// Check if user liked
			const userLikes = await db
				.select({ subject: likes.subject })
				.from(likes)
				.where(and(inArray(likes.subject, uris), eq(likes.author, did)))
				.all();

			const userLikedSet = new Set(userLikes.map((l) => l.subject));

			gifs.forEach((gif) => {
				gif.likeCount = Number(likeCountMap.get(gif.uri) || 0);
				gif.isLiked = userLikedSet.has(gif.uri);
			});
		}

		return c.json({ gifs, cursor: data.cursor });
	} catch (error) {
		console.error("List GIFs error:", error);
		return c.json(
			{
				error: "Failed to list GIFs",
				message: extractErrorMessage(error),
			},
			500,
		);
	}
});

/**
 * List User GIFs
 * GET /api/gif/user/:did
 */
gif.get("/user/:did", requireAuth, async (c) => {
	const session = c.get("session");
	const targetDid = c.req.param("did") as Did;

	try {
		const rpc = createRpcClient(session);

		const data = await ok(
			rpc.get("com.atproto.repo.listRecords", {
				params: {
					repo: targetDid,
					collection: GIF_COLLECTION,
					limit: 50,
				},
			}),
		);

		const gifs = data.records.map(toGifView);

		// Enrich with likes
		if (gifs.length > 0) {
			const db = drizzle(c.env.jjalcloud_db);
			const uris = gifs.map((g) => g.uri);
			const currentDid = c.get("did"); // Needs to check if logged in for isLiked? requireAuth ensures DID is present.

			// Get like counts
			const likeCounts = await db
				.select({
					subject: likes.subject,
					count: sql<number>`count(*)`,
				})
				.from(likes)
				.where(inArray(likes.subject, uris))
				.groupBy(likes.subject)
				.all();

			const likeCountMap = new Map(likeCounts.map((l) => [l.subject, l.count]));

			// Check if user liked (if did is present)
			let userLikedSet = new Set<string>();
			if (currentDid) {
				const userLikes = await db
					.select({ subject: likes.subject })
					.from(likes)
					.where(
						and(inArray(likes.subject, uris), eq(likes.author, currentDid)),
					)
					.all();
				userLikedSet = new Set(userLikes.map((l) => l.subject));
			}

			gifs.forEach((gif) => {
				gif.likeCount = Number(likeCountMap.get(gif.uri) || 0);
				gif.isLiked = userLikedSet.has(gif.uri);
			});
		}

		return c.json({ gifs, cursor: data.cursor });
	} catch (error) {
		console.error("List user GIFs error:", error);
		return c.json(
			{
				error: "Failed to list user GIFs",
				message: extractErrorMessage(error),
			},
			500,
		);
	}
});

/**
 * Get Single GIF
 * GET /api/gif/:rkey
 */
gif.get("/:rkey", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	const rkey = c.req.param("rkey");

	try {
		const db = drizzle(c.env.jjalcloud_db);

		// 1. Find GIF in D1 (using LIKE to match rkey at the end of URI)
		// URI format: at://did:plc:.../collection/rkey
		const foundGifs = await db
			.select()
			.from(gifsTable)
			.where(sql`${gifsTable.uri} LIKE ${`%${rkey}`}`)
			.limit(1)
			.all();

		if (!foundGifs || foundGifs.length === 0) {
			return c.json({ error: "GIF not found" }, 404);
		}

		const gifRecord = foundGifs[0];
		const uri = gifRecord.uri;
		const gifView = toGifViewFromDbRecord(gifRecord);

		// 2. Get Like Info
		const likeCountRes = await db
			.select({ count: sql<number>`count(*)` })
			.from(likes)
			.where(eq(likes.subject, uri))
			.get();
		const likeCount = likeCountRes ? likeCountRes.count : 0;

		let isLiked = false;
		if (did) {
			const userLike = await db
				.select()
				.from(likes)
				.where(and(eq(likes.subject, uri), eq(likes.author, did)))
				.get();
			isLiked = !!userLike;
		}

		return c.json({
			uri: gifView.uri,
			cid: gifView.cid,
			rkey,
			title: gifView.title,
			alt: gifView.alt,
			tags: gifView.tags,
			file: gifView.file,
			createdAt: gifRecord.createdAt,
			authorDid: gifRecord.author, // Return author DID for frontend to fetch profile
			likeCount: Number(likeCount),
			isLiked,
		});
	} catch (error) {
		console.error("Get GIF error:", error);
		return c.json(
			{ error: "Failed to get GIF", message: extractErrorMessage(error) },
			500,
		);
	}
});

/**
 * Create GIF
 * POST /api/gif
 *
 * FormData:
 * - file: GIF file (required)
 * - title: Title (optional)
 * - alt: Alt text (optional)
 * - tags: Tags (optional, comma-separated)
 */
gif.post("/", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;

	try {
		const formData = await c.req.formData();
		const file = formData.get("file") as File | null;
		const title = formData.get("title") as string | null;
		const alt = formData.get("alt") as string | null;
		const tagsStr = formData.get("tags") as string | null;
		const widthStr = formData.get("width") as string | null;
		const heightStr = formData.get("height") as string | null;

		if (!file) {
			return c.json({ error: "File is required" }, 400);
		}

		// Verify GIF file
		if (!file.type.includes("gif")) {
			return c.json({ error: "Only GIF files are allowed" }, 400);
		}

		// Verify file size
		if (file.size > MAX_GIF_SIZE) {
			return c.json({ error: "File size must be less than 20MB" }, 400);
		}

		// Parse tags
		const tags = parseTags(tagsStr, MAX_TAGS_COUNT);

		const rpc = createRpcClient(session);

		// 1. Upload Blob
		const blobData = await ok(
			rpc.post("com.atproto.repo.uploadBlob", {
				input: file,
			}),
		);

		// 2. Create GIF Record
		const rkey = TID.nextStr();
		const record: Record<string, unknown> = {
			$type: GIF_COLLECTION,
			file: blobData.blob,
			createdAt: new Date().toISOString(),
		};

		if (title) record.title = title;
		if (alt) record.alt = alt;
		if (tags && tags.length > 0) record.tags = tags;
		if (widthStr) record.width = Number.parseInt(widthStr, 10);
		if (heightStr) record.height = Number.parseInt(heightStr, 10);

		const result = await ok(
			rpc.post("com.atproto.repo.putRecord", {
				input: {
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
					record,
				},
			}),
		);

		return c.json(
			{
				success: true,
				uri: result.uri,
				cid: result.cid,
				rkey,
				message: "GIF successfully uploaded.",
			},
			201,
		);
	} catch (error) {
		console.error("Create GIF error:", error);
		return c.json(
			{
				error: "Failed to create GIF",
				message: extractErrorMessage(error),
			},
			500,
		);
	}
});

/**
 * Update GIF
 * PUT /api/gif/:rkey
 *
 * JSON Body:
 * - title: Title (optional)
 * - alt: Alt text (optional)
 * - tags: Tags array (optional)
 */
gif.put("/:rkey", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;
	const rkey = c.req.param("rkey");

	try {
		const rpc = createRpcClient(session);

		// Get existing record
		const existingData = await ok(
			rpc.get("com.atproto.repo.getRecord", {
				params: {
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
				},
			}),
		);

		const body = (await c.req.json()) as {
			title?: string;
			alt?: string;
			tags?: string[];
		};

		const existingValue = existingData.value as unknown as GifRecord;

		// Create record to update (preserve existing values, overwrite with new ones)
		const updatedRecord: Record<string, unknown> = {
			$type: GIF_COLLECTION,
			file: existingValue.file, // do not change file
			createdAt: existingValue.createdAt, // preserve creation time
		};

		// Preserve width/height
		if (existingValue.width) updatedRecord.width = existingValue.width;
		if (existingValue.height) updatedRecord.height = existingValue.height;

		// Update optional fields
		if (body.title !== undefined) {
			updatedRecord.title = body.title || undefined;
		} else if (existingValue.title) {
			updatedRecord.title = existingValue.title;
		}

		if (body.alt !== undefined) {
			updatedRecord.alt = body.alt || undefined;
		} else if (existingValue.alt) {
			updatedRecord.alt = existingValue.alt;
		}

		if (body.tags !== undefined) {
			updatedRecord.tags =
				Array.isArray(body.tags) && body.tags.length > 0
					? body.tags.slice(0, MAX_TAGS_COUNT)
					: undefined;
		} else if (existingValue.tags) {
			updatedRecord.tags = existingValue.tags;
		}

		// Update record
		const result = await ok(
			rpc.post("com.atproto.repo.putRecord", {
				input: {
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
					record: updatedRecord,
					swapRecord: existingData.cid, // CAS 보장
				},
			}),
		);

		return c.json({
			success: true,
			uri: result.uri,
			cid: result.cid,
			rkey,
			message: "GIF successfully updated.",
		});
	} catch (error) {
		if (error instanceof ClientResponseError && error.status === 404) {
			return c.json({ error: "GIF not found" }, 404);
		}
		console.error("Update GIF error:", error);
		return c.json(
			{
				error: "Failed to update GIF",
				message: extractErrorMessage(error),
			},
			500,
		);
	}
});

/**
 * Delete GIF
 * DELETE /api/gif/:rkey
 */
gif.delete("/:rkey", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;
	const rkey = c.req.param("rkey");

	try {
		const rpc = createRpcClient(session);

		await ok(
			rpc.post("com.atproto.repo.deleteRecord", {
				input: {
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
				},
			}),
		);

		return c.json({
			success: true,
			message: "GIF successfully deleted.",
		});
	} catch (error) {
		if (error instanceof ClientResponseError && error.status === 404) {
			return c.json({ error: "GIF not found" }, 404);
		}
		console.error("Delete GIF error:", error);
		return c.json(
			{
				error: "Failed to delete GIF",
				message: extractErrorMessage(error),
			},
			500,
		);
	}
});

export default gif;
