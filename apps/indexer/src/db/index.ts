import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gifs, likes } from "@jjalcloud/common/db/schema";
import BetterSqlite3 from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";
import type { Logger } from "pino";
import { createD1HttpDriver } from "./d1-http-driver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../");
const WEB_WRANGLER_DIR = path.join(WORKSPACE_ROOT, "apps/web/.wrangler");

function findD1Database(customPath?: string): string {
	if (customPath) {
		const resolvedPath = path.isAbsolute(customPath)
			? customPath
			: path.resolve(WORKSPACE_ROOT, customPath);

		if (!fs.existsSync(resolvedPath)) {
			throw new Error(`Local DB file not found: ${resolvedPath}`);
		}

		return resolvedPath;
	}

	const d1StateDir = path.join(
		WEB_WRANGLER_DIR,
		"state/v3/d1/miniflare-D1DatabaseObject",
	);

	if (!fs.existsSync(d1StateDir)) {
		throw new Error(
			`D1 State Directory not found: ${d1StateDir}. Please run 'pnpm dev' in apps/web first.`,
		);
	}

	const files = fs.readdirSync(d1StateDir).filter((f) => f.endsWith(".sqlite"));
	if (files.length === 0) {
		throw new Error("No SQLite database found in .wrangler state.");
	}

	return path.join(d1StateDir, files[0]);
}

const schema = { likes, gifs };

// biome-ignore lint/suspicious/noExplicitAny: Required for generic database type
export type Database = BaseSQLiteDatabase<"sync" | "async", any, typeof schema>;

export interface LikeInsertData {
	subject: string;
	author: string;
	rkey: string;
	createdAt: Date;
}

export interface LikeDeleteData {
	rkey: string;
	author: string;
}

export interface GifUpsertData {
	uri: string;
	cid: string;
	author: string;
	title: string | null | undefined;
	alt: string | null | undefined;
	tags: string[] | null | undefined;
	file: unknown;
	width: number | null | undefined;
	height: number | null | undefined;
	createdAt: Date;
}

export interface GifDeleteData {
	uri: string;
}

export interface BatchOperations {
	gifUpserts: GifUpsertData[];
	gifDeletes: GifDeleteData[];
	likeInserts: LikeInsertData[];
	likeDeletes: LikeDeleteData[];
}

export type BatchExecutor = (operations: BatchOperations) => Promise<void>;

export interface DatabaseClient {
	db: Database;
	executeBatch: BatchExecutor;
}

export interface LocalDatabaseOptions {
	logger?: Logger;
	dbPath?: string;
}

export function createLocalDatabase(
	options?: LocalDatabaseOptions,
): DatabaseClient {
	const dbPath = findD1Database(options?.dbPath);
	const logger = options?.logger;
	logger?.info({ dbPath }, "Using local D1 database");

	const sqlite = new BetterSqlite3(dbPath);
	const db = drizzleBetterSqlite(sqlite, { schema });
	const executeBatch = createBatchExecutor(db);

	return { db, executeBatch };
}

export function createRemoteDatabase(
	config: {
		accountId: string;
		databaseId: string;
		apiToken: string;
	},
	logger?: Logger,
): DatabaseClient {
	logger?.info("Using D1 HTTP API");

	const { proxyDriver } = createD1HttpDriver({
		accountId: config.accountId,
		databaseId: config.databaseId,
		apiToken: config.apiToken,
		logger,
	});

	const db = drizzleSqliteProxy(proxyDriver, { schema });
	const executeBatch = createBatchExecutor(db);

	return { db, executeBatch };
}

/**
 * Database operations using Drizzle ORM
 * All operations are unified across local and remote databases
 */
export const dbOperations = {
	async insertLike(db: Database, data: LikeInsertData) {
		await db
			.delete(likes)
			.where(and(eq(likes.rkey, data.rkey), eq(likes.author, data.author)));

		await db.insert(likes).values({
			subject: data.subject,
			author: data.author,
			rkey: data.rkey,
			createdAt: data.createdAt,
		});
	},

	async deleteLike(db: Database, rkey: string, author: string) {
		await db
			.delete(likes)
			.where(and(eq(likes.rkey, rkey), eq(likes.author, author)));
	},

	async upsertGif(db: Database, data: GifUpsertData) {
		await db
			.insert(gifs)
			.values({
				uri: data.uri,
				cid: data.cid,
				author: data.author,
				title: data.title ?? null,
				alt: data.alt ?? null,
				tags: data.tags ? JSON.stringify(data.tags) : null,
				file: data.file,
				width: data.width ?? null,
				height: data.height ?? null,
				createdAt: data.createdAt,
			})
			.onConflictDoUpdate({
				target: gifs.uri,
				set: {
					cid: data.cid,
					title: data.title ?? null,
					alt: data.alt ?? null,
					tags: data.tags ? JSON.stringify(data.tags) : null,
					file: data.file,
					width: data.width ?? null,
					height: data.height ?? null,
					createdAt: data.createdAt,
				},
			});
	},

	async deleteGif(db: Database, uri: string) {
		await db.delete(gifs).where(eq(gifs.uri, uri));
	},

	async getGifUrisByAuthor(db: Database, author: string): Promise<string[]> {
		const rows = await db
			.select({ uri: gifs.uri })
			.from(gifs)
			.where(eq(gifs.author, author));
		return rows.map((row) => row.uri);
	},

	async getLikeRkeysByAuthor(db: Database, author: string): Promise<string[]> {
		const rows = await db
			.select({ rkey: likes.rkey })
			.from(likes)
			.where(eq(likes.author, author));
		return rows.map((row) => row.rkey);
	},
};

function createBatchExecutor(db: Database): BatchExecutor {
	return async (operations) => {
		for (const gifUpsert of operations.gifUpserts) {
			await dbOperations.upsertGif(db, gifUpsert);
		}

		for (const gifDelete of operations.gifDeletes) {
			await dbOperations.deleteGif(db, gifDelete.uri);
		}

		for (const likeInsert of operations.likeInserts) {
			await dbOperations.insertLike(db, likeInsert);
		}

		for (const likeDelete of operations.likeDeletes) {
			await dbOperations.deleteLike(db, likeDelete.rkey, likeDelete.author);
		}
	};
}
