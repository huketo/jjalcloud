import { Hono } from "hono";
import { requireAuth, type AuthenticatedEnv } from "../lib/auth/middleware";
import { TID } from "@atproto/common-web";

const gif = new Hono<AuthenticatedEnv>();

// GIF 컬렉션 NSID
const GIF_COLLECTION = "com.jjalcloud.feed.gif";

// ATProto API 응답 타입
interface ListRecordsResponse {
	records: Array<{
		uri: string;
		cid: string;
		value: Record<string, unknown>;
	}>;
	cursor?: string;
}

interface GetRecordResponse {
	uri: string;
	cid: string;
	value: Record<string, unknown>;
}

interface UploadBlobResponse {
	blob: unknown;
}

interface PutRecordResponse {
	uri: string;
	cid: string;
}

/**
 * GIF 목록 조회 (내 GIF)
 * GET /api/gif
 */
gif.get("/", requireAuth, async (c) => {
	const session = c.get("session");
	const did = c.get("did");

	try {
		// PDS에서 GIF 레코드 목록 조회
		const response = await session.fetchHandler(
			`/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(GIF_COLLECTION)}&limit=50`,
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(
				`Failed to list records: ${response.status} - ${error}`,
			);
		}

		const data = (await response.json()) as ListRecordsResponse;

		// GIF 목록 변환
		const gifs = data.records.map((record: any) => ({
			uri: record.uri,
			cid: record.cid,
			rkey: record.uri.split("/").pop(),
			title: record.value.title,
			alt: record.value.alt,
			tags: record.value.tags || [],
			file: record.value.file,
			createdAt: record.value.createdAt,
		}));

		return c.json({
			gifs,
			cursor: data.cursor,
		});
	} catch (error) {
		console.error("List GIFs error:", error);
		return c.json(
			{
				error: "Failed to list GIFs",
				message:
					error instanceof Error ? error.message : "Unknown error",
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
	const targetDid = c.req.param("did");

	try {
		const response = await session.fetchHandler(
			`/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(targetDid)}&collection=${encodeURIComponent(GIF_COLLECTION)}&limit=50`,
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(
				`Failed to list records: ${response.status} - ${error}`,
			);
		}

		const data = (await response.json()) as ListRecordsResponse;

		const gifs = data.records.map((record) => ({
			uri: record.uri,
			cid: record.cid,
			rkey: record.uri.split("/").pop(),
			title: record.value.title as string | undefined,
			alt: record.value.alt as string | undefined,
			tags: (record.value.tags as string[]) || [],
			file: record.value.file,
			createdAt: record.value.createdAt as string,
		}));

		return c.json({
			gifs,
			cursor: data.cursor,
		});
	} catch (error) {
		console.error("List user GIFs error:", error);
		return c.json(
			{
				error: "Failed to list user GIFs",
				message:
					error instanceof Error ? error.message : "Unknown error",
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
	const did = c.get("did");
	const rkey = c.req.param("rkey");

	try {
		const response = await session.fetchHandler(
			`/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(GIF_COLLECTION)}&rkey=${encodeURIComponent(rkey)}`,
		);

		if (!response.ok) {
			if (response.status === 404) {
				return c.json({ error: "GIF not found" }, 404);
			}
			const error = await response.text();
			throw new Error(
				`Failed to get record: ${response.status} - ${error}`,
			);
		}

		const data = (await response.json()) as GetRecordResponse;

		return c.json({
			uri: data.uri,
			cid: data.cid,
			rkey,
			title: data.value.title as string | undefined,
			alt: data.value.alt as string | undefined,
			tags: (data.value.tags as string[]) || [],
			file: data.value.file,
			createdAt: data.value.createdAt as string,
		});
	} catch (error) {
		console.error("Get GIF error:", error);
		return c.json(
			{
				error: "Failed to get GIF",
				message:
					error instanceof Error ? error.message : "Unknown error",
			},
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
	const did = c.get("did");

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

		// 파일 크기 검증 (20MB 제한)
		if (file.size > 20 * 1024 * 1024) {
			return c.json({ error: "File size must be less than 20MB" }, 400);
		}

		// 태그 파싱
		const tags = tagsStr
			? tagsStr
					.split(",")
					.map((t) => t.trim())
					.filter((t) => t.length > 0)
					.slice(0, 10)
			: undefined;

		// 1. Blob 업로드
		const fileBuffer = await file.arrayBuffer();
		const uploadResponse = await session.fetchHandler(
			"/xrpc/com.atproto.repo.uploadBlob",
			{
				method: "POST",
				headers: {
					"Content-Type": file.type,
				},
				body: fileBuffer,
			},
		);

		if (!uploadResponse.ok) {
			const error = await uploadResponse.text();
			throw new Error(
				`Failed to upload blob: ${uploadResponse.status} - ${error}`,
			);
		}

		const blobData = (await uploadResponse.json()) as UploadBlobResponse;

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

		const createResponse = await session.fetchHandler(
			"/xrpc/com.atproto.repo.putRecord",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
					record,
				}),
			},
		);

		if (!createResponse.ok) {
			const error = await createResponse.text();
			throw new Error(
				`Failed to create record: ${createResponse.status} - ${error}`,
			);
		}

		const result = (await createResponse.json()) as PutRecordResponse;

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
				message:
					error instanceof Error ? error.message : "Unknown error",
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
	const did = c.get("did");
	const rkey = c.req.param("rkey");

	try {
		// 기존 레코드 조회
		const getResponse = await session.fetchHandler(
			`/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(GIF_COLLECTION)}&rkey=${encodeURIComponent(rkey)}`,
		);

		if (!getResponse.ok) {
			if (getResponse.status === 404) {
				return c.json({ error: "GIF not found" }, 404);
			}
			const error = await getResponse.text();
			throw new Error(
				`Failed to get record: ${getResponse.status} - ${error}`,
			);
		}

		const existingData = (await getResponse.json()) as GetRecordResponse;
		const body = (await c.req.json()) as {
			title?: string;
			alt?: string;
			tags?: string[];
		};

		// 업데이트할 레코드 생성 (기존 값 유지, 새 값으로 덮어쓰기)
		const updatedRecord: Record<string, unknown> = {
			$type: GIF_COLLECTION,
			file: existingData.value.file, // 파일은 변경하지 않음
			createdAt: existingData.value.createdAt, // 생성 시간 유지
		};

		// 선택적 필드 업데이트
		if (body.title !== undefined) {
			updatedRecord.title = body.title || undefined;
		} else if (existingData.value.title) {
			updatedRecord.title = existingData.value.title;
		}

		if (body.alt !== undefined) {
			updatedRecord.alt = body.alt || undefined;
		} else if (existingData.value.alt) {
			updatedRecord.alt = existingData.value.alt;
		}

		if (body.tags !== undefined) {
			updatedRecord.tags =
				Array.isArray(body.tags) && body.tags.length > 0
					? body.tags.slice(0, 10)
					: undefined;
		} else if (existingData.value.tags) {
			updatedRecord.tags = existingData.value.tags;
		}

		// 레코드 업데이트
		const updateResponse = await session.fetchHandler(
			"/xrpc/com.atproto.repo.putRecord",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
					record: updatedRecord,
					swapRecord: existingData.cid, // CAS 보장
				}),
			},
		);

		if (!updateResponse.ok) {
			const error = await updateResponse.text();
			throw new Error(
				`Failed to update record: ${updateResponse.status} - ${error}`,
			);
		}

		const result = (await updateResponse.json()) as PutRecordResponse;

		return c.json({
			success: true,
			uri: result.uri,
			cid: result.cid,
			rkey,
			message: "GIF가 성공적으로 수정되었습니다.",
		});
	} catch (error) {
		console.error("Update GIF error:", error);
		return c.json(
			{
				error: "Failed to update GIF",
				message:
					error instanceof Error ? error.message : "Unknown error",
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
	const did = c.get("did");
	const rkey = c.req.param("rkey");

	try {
		const deleteResponse = await session.fetchHandler(
			"/xrpc/com.atproto.repo.deleteRecord",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					repo: did,
					collection: GIF_COLLECTION,
					rkey,
				}),
			},
		);

		if (!deleteResponse.ok) {
			if (deleteResponse.status === 404) {
				return c.json({ error: "GIF not found" }, 404);
			}
			const error = await deleteResponse.text();
			throw new Error(
				`Failed to delete record: ${deleteResponse.status} - ${error}`,
			);
		}

		return c.json({
			success: true,
			message: "GIF가 성공적으로 삭제되었습니다.",
		});
	} catch (error) {
		console.error("Delete GIF error:", error);
		return c.json(
			{
				error: "Failed to delete GIF",
				message:
					error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

export default gif;
