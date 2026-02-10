import { gifs, likes, users } from "@jjalcloud/common/db/schema";
import type { Record as GifRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/gif";
import type { Record as LikeRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/like";
import type { Logger } from "pino";
import type { Database } from "./db/index.js";
import { dbOperations } from "./db/index.js";

const DEFAULT_PDS = "https://bsky.social";

interface ListRecordsResponse {
	records: Array<{
		uri: string;
		cid: string;
		value: unknown;
	}>;
	cursor?: string;
}

interface BackfillOptions {
	db: Database;
	logger: Logger;
	dids?: string[]; // 특정 DID 목록, 없으면 DB에서 기존 author들 조회
	pdsUrl?: string;
}

interface BackfillCollectionResult {
	count: number;
	pdsUris: Set<string>;
	completed: boolean;
}

/**
 * AT Protocol repo에서 기존 레코드를 백필합니다.
 */
export async function backfill(options: BackfillOptions): Promise<void> {
	const { db, logger, pdsUrl = DEFAULT_PDS } = options;

	// 백필할 DID 목록 결정
	let dids = options.dids;

	if (!dids || dids.length === 0) {
		logger.info("No DIDs provided, fetching existing authors from database...");
		dids = await getExistingAuthors(db);

		if (dids.length === 0) {
			logger.warn(
				"No authors found in database. Please provide DIDs via --dids argument or add some records first.",
			);
			return;
		}
	}

	logger.info({ count: dids.length }, "Starting backfill for DIDs");

	let totalGifs = 0;
	let totalLikes = 0;
	let totalOrphanGifs = 0;
	let totalOrphanLikes = 0;

	for (const did of dids) {
		logger.info({ did }, "Backfilling user");

		try {
			// GIF 레코드 백필
			const gifResult = await backfillCollection(
				pdsUrl,
				db,
				logger,
				did,
				"com.jjalcloud.feed.gif",
				async (record, uri, cid) => {
					const gifRecord = record as GifRecord;
					const createdAt = gifRecord.createdAt
						? new Date(gifRecord.createdAt)
						: new Date();

					await dbOperations.upsertGif(db, {
						uri,
						cid,
						author: did,
						title: gifRecord.title,
						alt: gifRecord.alt,
						tags: gifRecord.tags,
						file: gifRecord.file,
						width: gifRecord.width,
						height: gifRecord.height,
						createdAt,
					});
				},
			);
			totalGifs += gifResult.count;

			// Like 레코드 백필
			const likeResult = await backfillCollection(
				pdsUrl,
				db,
				logger,
				did,
				"com.jjalcloud.feed.like",
				async (record, uri, _cid) => {
					const likeRecord = record as LikeRecord;
					const subjectUri = likeRecord.subject?.uri as string | undefined;

					if (!subjectUri) {
						logger.warn({ uri }, "Like record missing subject URI, skipping");
						return;
					}

					// URI에서 rkey 추출: at://did:plc:xxx/com.jjalcloud.feed.like/rkey
					const rkey = uri.split("/").pop();
					if (!rkey) {
						logger.warn({ uri }, "Could not extract rkey from URI, skipping");
						return;
					}

					const createdAt = likeRecord.createdAt
						? new Date(likeRecord.createdAt)
						: new Date();

					await dbOperations.insertLike(db, {
						subject: subjectUri,
						author: did,
						rkey,
						createdAt,
					});
				},
			);
			totalLikes += likeResult.count;

			const orphanGifs = await cleanupOrphanGifs(db, logger, did, gifResult);
			totalOrphanGifs += orphanGifs;

			const orphanLikes = await cleanupOrphanLikes(db, logger, did, likeResult);
			totalOrphanLikes += orphanLikes;
		} catch (err) {
			logger.error({ did, err }, "Failed to backfill user");
		}
	}

	logger.info(
		{
			totalGifs,
			totalLikes,
			totalOrphanGifs,
			totalOrphanLikes,
			userCount: dids.length,
		},
		"Backfill completed",
	);
}

/**
 * 특정 컬렉션의 레코드를 백필합니다.
 */
async function backfillCollection(
	pdsUrl: string,
	_db: Database,
	logger: Logger,
	did: string,
	collection: string,
	processRecord: (record: unknown, uri: string, cid: string) => Promise<void>,
): Promise<BackfillCollectionResult> {
	let cursor: string | undefined;
	let count = 0;
	const pdsUris = new Set<string>();
	let completed = false;

	do {
		try {
			const params = new URLSearchParams({
				repo: did,
				collection,
				limit: "100",
			});
			if (cursor) {
				params.set("cursor", cursor);
			}

			const url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params.toString()}`;
			const res = await fetch(url);

			if (!res.ok) {
				logger.debug(
					{ did, collection, status: res.status },
					"Could not fetch collection",
				);
				break;
			}

			const data = (await res.json()) as ListRecordsResponse;
			const records = data.records;

			for (const record of records) {
				pdsUris.add(record.uri);
				try {
					await processRecord(record.value, record.uri, record.cid);
					count++;
					logger.debug({ uri: record.uri, collection }, "Backfilled record");
				} catch (err) {
					// Duplicate key 에러 등은 무시 (이미 존재하는 레코드)
					logger.debug(
						{ uri: record.uri, err },
						"Record already exists or failed to insert",
					);
				}
			}

			cursor = data.cursor;
		} catch (err) {
			// 컬렉션이 없거나 접근 불가한 경우
			logger.debug({ did, collection, err }, "Could not fetch collection");
			break;
		}
	} while (cursor);

	// Pagination이 정상적으로 완료된 경우에만 completed = true
	if (!cursor) {
		completed = true;
	}

	if (count > 0) {
		logger.info({ did, collection, count }, "Backfilled collection");
	}

	return { count, pdsUris, completed };
}

/**
 * PDS에서 정상적으로 전체 목록을 가져온 경우, D1에만 존재하는 orphan GIF를 삭제합니다.
 */
async function cleanupOrphanGifs(
	db: Database,
	logger: Logger,
	did: string,
	result: BackfillCollectionResult,
): Promise<number> {
	if (!result.completed) {
		logger.warn(
			{ did },
			"Skipping GIF orphan cleanup - PDS fetch did not complete successfully",
		);
		return 0;
	}

	const dbGifUris = await dbOperations.getGifUrisByAuthor(db, did);
	const orphanUris = dbGifUris.filter((uri) => !result.pdsUris.has(uri));

	if (orphanUris.length === 0) {
		return 0;
	}

	logger.info(
		{ did, count: orphanUris.length },
		"Removing orphaned GIF records",
	);

	for (const uri of orphanUris) {
		try {
			logger.debug({ uri }, "Deleting orphaned GIF");
			await dbOperations.deleteGif(db, uri);
		} catch (err) {
			logger.error({ uri, err }, "Failed to delete orphaned GIF");
		}
	}

	return orphanUris.length;
}

/**
 * PDS에서 정상적으로 전체 목록을 가져온 경우, D1에만 존재하는 orphan Like를 삭제합니다.
 */
async function cleanupOrphanLikes(
	db: Database,
	logger: Logger,
	did: string,
	result: BackfillCollectionResult,
): Promise<number> {
	if (!result.completed) {
		logger.warn(
			{ did },
			"Skipping Like orphan cleanup - PDS fetch did not complete successfully",
		);
		return 0;
	}

	const dbLikeRkeys = await dbOperations.getLikeRkeysByAuthor(db, did);
	const pdsRkeys = new Set<string>();
	for (const uri of result.pdsUris) {
		const rkey = uri.split("/").pop();
		if (rkey) pdsRkeys.add(rkey);
	}

	const orphanRkeys = dbLikeRkeys.filter((rkey) => !pdsRkeys.has(rkey));

	if (orphanRkeys.length === 0) {
		return 0;
	}

	logger.info(
		{ did, count: orphanRkeys.length },
		"Removing orphaned Like records",
	);

	for (const rkey of orphanRkeys) {
		try {
			logger.debug({ rkey, author: did }, "Deleting orphaned Like");
			await dbOperations.deleteLike(db, rkey, did);
		} catch (err) {
			logger.error(
				{ rkey, author: did, err },
				"Failed to delete orphaned Like",
			);
		}
	}

	return orphanRkeys.length;
}

/**
 * DB에서 기존 author DID 목록을 조회합니다.
 */
async function getExistingAuthors(db: Database): Promise<string[]> {
	// 1. users 테이블에서 로그인한 유저 DID 목록 조회 (우선순위)
	const registeredUsers = await db.select({ did: users.did }).from(users);

	const authorSet = new Set<string>();

	// 로그인한 유저들의 DID 추가
	for (const user of registeredUsers || []) {
		if (user.did) authorSet.add(user.did);
	}

	// 2. gifs와 likes 테이블에서 unique author 목록 조회 (추가)
	const gifAuthors = await db
		.selectDistinct({ author: gifs.author })
		.from(gifs);

	const likeAuthors = await db
		.selectDistinct({ author: likes.author })
		.from(likes);

	for (const row of gifAuthors || []) {
		if (row.author) authorSet.add(row.author);
	}
	for (const row of likeAuthors || []) {
		if (row.author) authorSet.add(row.author);
	}

	return Array.from(authorSet);
}

/**
 * CLI에서 전달받은 DID 목록을 파싱합니다.
 */
export function parseDids(didsArg: string | undefined): string[] | undefined {
	if (!didsArg) return undefined;
	return didsArg
		.split(",")
		.map((d) => d.trim())
		.filter(Boolean);
}
