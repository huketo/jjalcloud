import { Hono } from "hono";
import { requireAuth, type AuthenticatedEnv } from "../middleware";
import { TID } from "@atproto/common-web";
import { ok, ClientResponseError } from "@atcute/client";
import type {} from "@atcute/atproto";
import type { Did } from "@atcute/lexicons/syntax";
import { GIF_COLLECTION, MAX_GIF_SIZE, MAX_TAGS_COUNT } from "../constants";
import { createRpcClient, extractErrorMessage } from "../utils";
import { type GifRecord, toGifView, parseTags } from "../types/gif";

const gif = new Hono<AuthenticatedEnv>();

/**
 * GIF 목록 조회 (내 GIF)
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
 * 특정 사용자의 GIF 목록 조회
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
 * 단일 GIF 조회
 * GET /api/gif/:rkey
 */
gif.get("/:rkey", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;
	const rkey = c.req.param("rkey");

	try {
		const rpc = createRpcClient(session);

		const data = await ok(
			rpc.get("com.atproto.repo.getRecord", {
				params: {
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
				},
			}),
		);

		return c.json({
			uri: data.uri,
			cid: data.cid,
			rkey,
			title: (data.value as GifRecord).title,
			alt: (data.value as GifRecord).alt,
			tags: (data.value as GifRecord).tags || [],
			file: (data.value as GifRecord).file,
			createdAt: (data.value as GifRecord).createdAt,
		});
	} catch (error) {
		if (error instanceof ClientResponseError && error.status === 404) {
			return c.json({ error: "GIF not found" }, 404);
		}
		console.error("Get GIF error:", error);
		return c.json(
			{ error: "Failed to get GIF", message: extractErrorMessage(error) },
			500,
		);
	}
});

/**
 * GIF 업로드 (Create)
 * POST /api/gif
 *
 * FormData:
 * - file: GIF 파일 (required)
 * - title: 제목 (optional)
 * - alt: 대체 텍스트 (optional)
 * - tags: 태그 (optional, comma-separated)
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

		if (!file) {
			return c.json({ error: "File is required" }, 400);
		}

		// GIF 파일 검증
		if (!file.type.includes("gif")) {
			return c.json({ error: "Only GIF files are allowed" }, 400);
		}

		// 파일 크기 검증
		if (file.size > MAX_GIF_SIZE) {
			return c.json({ error: "File size must be less than 20MB" }, 400);
		}

		// 태그 파싱
		const tags = parseTags(tagsStr, MAX_TAGS_COUNT);

		const rpc = createRpcClient(session);

		// 1. Blob 업로드
		const blobData = await ok(
			rpc.post("com.atproto.repo.uploadBlob", {
				input: file,
			}),
		);

		// 2. GIF 레코드 생성
		const rkey = TID.nextStr();
		const record: Record<string, unknown> = {
			$type: GIF_COLLECTION,
			file: blobData.blob,
			createdAt: new Date().toISOString(),
		};

		if (title) record.title = title;
		if (alt) record.alt = alt;
		if (tags && tags.length > 0) record.tags = tags;

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
				message: "GIF가 성공적으로 업로드되었습니다.",
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
 * GIF 수정 (Update)
 * PUT /api/gif/:rkey
 *
 * JSON Body:
 * - title: 제목 (optional)
 * - alt: 대체 텍스트 (optional)
 * - tags: 태그 배열 (optional)
 */
gif.put("/:rkey", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did") as Did;
	const rkey = c.req.param("rkey");

	try {
		const rpc = createRpcClient(session);

		// 기존 레코드 조회
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

		const existingValue = existingData.value as GifRecord;

		// 업데이트할 레코드 생성 (기존 값 유지, 새 값으로 덮어쓰기)
		const updatedRecord: Record<string, unknown> = {
			$type: GIF_COLLECTION,
			file: existingValue.file, // 파일은 변경하지 않음
			createdAt: existingValue.createdAt, // 생성 시간 유지
		};

		// 선택적 필드 업데이트
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

		// 레코드 업데이트
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
			message: "GIF가 성공적으로 수정되었습니다.",
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
 * GIF 삭제 (Delete)
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
			message: "GIF가 성공적으로 삭제되었습니다.",
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
