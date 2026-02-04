import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globalGifs, likes } from "@jjalcloud/common/db/schema";
import BetterSqlite3 from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";
import type { Logger } from "pino";
import { createD1HttpDriver } from "./d1-http-driver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find D1 Database File (for development only)
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../");
const WEB_WRANGLER_DIR = path.join(WORKSPACE_ROOT, "apps/web/.wrangler");

function findD1Database() {
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

// Schema for type inference
const schema = { likes, globalGifs };

// Common database type that works with both sync and async drivers
// biome-ignore lint/suspicious/noExplicitAny: Required for generic database type
export type Database = BaseSQLiteDatabase<"sync" | "async", any, typeof schema>;

/**
 * Create local database client using better-sqlite3
 * Used in development to access the local D1 database file
 */
export function createLocalDatabase(logger?: Logger): Database {
	const dbPath = findD1Database();
	logger?.info({ dbPath }, "Using local D1 database");

	const sqlite = new BetterSqlite3(dbPath);
	return drizzleBetterSqlite(sqlite, { schema });
}

/**
 * Create remote database client using D1 HTTP API
 * Used in production to access Cloudflare D1
 */
export function createRemoteDatabase(
	config: {
		accountId: string;
		databaseId: string;
		apiToken: string;
	},
	logger?: Logger,
): Database {
	logger?.info("Using D1 HTTP API");

	const driver = createD1HttpDriver({
		accountId: config.accountId,
		databaseId: config.databaseId,
		apiToken: config.apiToken,
		logger,
	});

	return drizzleSqliteProxy(driver, { schema });
}

/**
 * Database operations using Drizzle ORM
 * All operations are unified across local and remote databases
 */
export const dbOperations = {
	async insertLike(
		db: Database,
		data: {
			subject: string;
			author: string;
			rkey: string;
			createdAt: Date;
		},
	) {
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

	async upsertGif(
		db: Database,
		data: {
			uri: string;
			cid: string;
			author: string;
			title: string | null | undefined;
			alt: string | null | undefined;
			tags: string[] | null | undefined;
			file: unknown;
			createdAt: Date;
		},
	) {
		await db
			.insert(globalGifs)
			.values({
				uri: data.uri,
				cid: data.cid,
				author: data.author,
				title: data.title ?? null,
				alt: data.alt ?? null,
				tags: data.tags ? JSON.stringify(data.tags) : null,
				file: data.file,
				createdAt: data.createdAt,
			})
			.onConflictDoUpdate({
				target: globalGifs.uri,
				set: {
					cid: data.cid,
					title: data.title ?? null,
					alt: data.alt ?? null,
					tags: data.tags ? JSON.stringify(data.tags) : null,
					file: data.file,
					createdAt: data.createdAt,
				},
			});
	},

	async deleteGif(db: Database, uri: string) {
		await db.delete(globalGifs).where(eq(globalGifs.uri, uri));
	},
};
