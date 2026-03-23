import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { gifs, likes, tags } from "../db/schema";

interface GifRecord {
	file: unknown;
	title?: string;
	alt?: string;
	tags?: string[];
	width?: number;
	height?: number;
	createdAt: string;
}

interface LikeRecord {
	subject: { uri: string; cid: string };
	createdAt: string;
}

export async function handleGifCreate(
	db: Database,
	uri: string,
	cid: string,
	author: string,
	rkey: string,
	record: GifRecord,
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(gifs)
			.values({
				uri,
				cid,
				author,
				rkey,
				title: record.title ?? null,
				alt: record.alt ?? null,
				width: record.width ?? null,
				height: record.height ?? null,
				file: record.file as any,
				createdAt: new Date(record.createdAt),
			})
			.onConflictDoNothing();

		if (record.tags?.length) {
			await tx.insert(tags).values(record.tags.map((name) => ({ gifUri: uri, name })));
		}
	});
}

export async function handleGifDelete(db: Database, uri: string): Promise<void> {
	await db.delete(gifs).where(eq(gifs.uri, uri));
}

export async function handleLikeCreate(
	db: Database,
	author: string,
	rkey: string,
	record: LikeRecord,
): Promise<void> {
	await db
		.insert(likes)
		.values({
			subject: record.subject.uri,
			author,
			rkey,
			createdAt: new Date(record.createdAt),
		})
		.onConflictDoNothing();
}

export async function handleLikeDelete(db: Database, author: string, rkey: string): Promise<void> {
	await db.delete(likes).where(and(eq(likes.author, author), eq(likes.rkey, rkey)));
}
