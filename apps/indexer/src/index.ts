import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IdResolver } from "@atproto/identity";
import type { Event } from "@atproto/sync";
import { Firehose } from "@atproto/sync";
import { globalGifs, likes } from "@jjalcloud/common/db/schema";
import type { Record as GifRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/gif";
import type { Record as LikeRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/like";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import pino from "pino";
import { D1HttpClient } from "./d1-client.js";
import { env, isProduction } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find D1 Database File (for development only)
// Logic: Look for .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite in apps/web
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../");
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

	// Return the first one found (assuming single DB for now)
	return path.join(d1StateDir, files[0]);
}

// Database abstraction layer
interface DatabaseAdapter {
	insertLike(data: {
		subject: string;
		author: string;
		rkey: string;
		createdAt: Date;
	}): Promise<void>;
	deleteLike(rkey: string, author: string): Promise<void>;
	upsertGif(data: {
		uri: string;
		cid: string;
		author: string;
		title: string | null | undefined;
		alt: string | null | undefined;
		tags: string[] | null | undefined;
		file: unknown;
		createdAt: Date;
	}): Promise<void>;
	deleteGif(uri: string): Promise<void>;
}

// Local SQLite adapter (development)
function createLocalAdapter(dbPath: string): DatabaseAdapter {
	const sqlite = new Database(dbPath);
	const db = drizzle(sqlite);

	return {
		async insertLike(data) {
			db.insert(likes)
				.values({
					subject: data.subject,
					author: data.author,
					rkey: data.rkey,
					createdAt: data.createdAt,
				})
				.run();
		},
		async deleteLike(rkey, author) {
			sqlite
				.prepare("DELETE FROM likes WHERE rkey = ? AND author = ?")
				.run(rkey, author);
		},
		async upsertGif(data) {
			db.insert(globalGifs)
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
				})
				.run();
		},
		async deleteGif(uri) {
			sqlite.prepare("DELETE FROM global_gifs WHERE uri = ?").run(uri);
		},
	};
}

// Remote D1 adapter (production)
function createRemoteAdapter(logger: pino.Logger): DatabaseAdapter {
	const {
		CLOUDFLARE_ACCOUNT_ID: accountId,
		CLOUDFLARE_DATABASE_ID: databaseId,
		CLOUDFLARE_API_TOKEN: apiToken,
	} = env;

	if (!accountId || !databaseId || !apiToken) {
		throw new Error(
			"Missing Cloudflare configuration - CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_API_TOKEN are required in production",
		);
	}

	const client = new D1HttpClient({
		accountId,
		databaseId,
		apiToken,
		logger,
	});

	return {
		insertLike: (data) => client.insertLike(data),
		deleteLike: (rkey, author) => client.deleteLike(rkey, author),
		upsertGif: (data) => client.upsertGif(data),
		deleteGif: (uri) => client.deleteGif(uri),
	};
}

async function main() {
	const logger = pino({ name: "firehose", level: env.LOG_LEVEL });

	// Initialize database adapter based on environment
	let adapter: DatabaseAdapter;

	if (isProduction) {
		logger.info("Running in PRODUCTION mode - connecting to Cloudflare D1");
		adapter = createRemoteAdapter(logger);
	} else {
		const dbPath = findD1Database();
		logger.info(
			{ dbPath },
			"Running in DEVELOPMENT mode - using local D1 database",
		);
		adapter = createLocalAdapter(dbPath);
	}

	const idResolver = new IdResolver({});

	const firehose = new Firehose({
		idResolver,
		filterCollections: ["com.jjalcloud.feed.like", "com.jjalcloud.feed.gif"],
		handleEvent: async (evt: Event) => {
			// Only handle commit events (create, update, delete)
			if (
				evt.event !== "create" &&
				evt.event !== "update" &&
				evt.event !== "delete"
			) {
				return;
			}

			// Handle Like events
			if (evt.collection === "com.jjalcloud.feed.like") {
				if (evt.event === "create" || evt.event === "update") {
					const record = evt.record as LikeRecord;
					const subjectUri = record.subject?.uri as string | undefined;
					const authorDid = evt.did;

					if (subjectUri && authorDid) {
						logger.info(
							{ uri: evt.uri.toString(), author: authorDid },
							"Indexing Like",
						);
						try {
							const createdAt = record.createdAt
								? new Date(record.createdAt)
								: new Date();

							await adapter.insertLike({
								subject: subjectUri,
								author: authorDid,
								rkey: evt.rkey,
								createdAt,
							});
						} catch (err: unknown) {
							logger.error({ err }, "Failed to insert like");
						}
					}
				} else if (evt.event === "delete") {
					logger.info({ uri: evt.uri.toString() }, "Deleting Like");
					try {
						await adapter.deleteLike(evt.rkey, evt.did);
					} catch (err) {
						logger.error({ err }, "Failed to delete like");
					}
				}
			}

			// Handle GIF events
			if (evt.collection === "com.jjalcloud.feed.gif") {
				if (evt.event === "create" || evt.event === "update") {
					const record = evt.record as GifRecord;
					logger.info({ uri: evt.uri.toString() }, "Indexing GIF");

					try {
						const createdAt = record.createdAt
							? new Date(record.createdAt)
							: new Date();

						await adapter.upsertGif({
							uri: evt.uri.toString(),
							cid: evt.cid.toString(),
							author: evt.did,
							title: record.title,
							alt: record.alt,
							tags: record.tags,
							file: record.file,
							createdAt,
						});
					} catch (err) {
						logger.error({ err }, "Failed to upsert GIF");
					}
				} else if (evt.event === "delete") {
					logger.info({ uri: evt.uri.toString() }, "Deleting GIF");
					try {
						await adapter.deleteGif(evt.uri.toString());
					} catch (err) {
						logger.error({ err }, "Failed to delete GIF");
					}
				}
			}
		},
		onError: (err) => {
			logger.error({ err }, "Firehose Error");
		},
		service: env.FIREHOSE_URL,
		excludeIdentity: true,
		excludeAccount: true,
	});

	logger.info(
		{ mode: isProduction ? "production" : "development" },
		"Starting Firehose...",
	);
	firehose.start();
}

main().catch((err) => {
	console.error("Fatal Error:", err);
	process.exit(1);
});
