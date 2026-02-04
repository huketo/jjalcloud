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
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/better-sqlite3";
import pino from "pino";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const FIREHOSE_URL = process.env.FIREHOSE_URL || "wss://bsky.network";

// Find D1 Database File
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

async function main() {
	const logger = pino({ name: "firehose", level: LOG_LEVEL });

	const dbPath = findD1Database();
	logger.info({ dbPath }, "Found D1 Database");

	const sqlite = new Database(dbPath);
	const db = drizzle(sqlite);

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

							db.insert(likes)
								.values({
									subject: subjectUri,
									author: authorDid,
									rkey: evt.rkey,
									createdAt,
								})
								.run();
						} catch (err: unknown) {
							logger.error({ err }, "Failed to insert like");
						}
					}
				} else if (evt.event === "delete") {
					logger.info({ uri: evt.uri.toString() }, "Deleting Like");
					try {
						sqlite
							.prepare("DELETE FROM likes WHERE rkey = ? AND author = ?")
							.run(evt.rkey, evt.did);
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

						db.insert(globalGifs)
							.values({
								uri: evt.uri.toString(),
								cid: evt.cid.toString(),
								author: evt.did,
								title: record.title,
								alt: record.alt,
								tags: record.tags ? JSON.stringify(record.tags) : null,
								file: record.file, // Stored as JSON
								createdAt,
							})
							.onConflictDoUpdate({
								target: globalGifs.uri,
								set: {
									cid: evt.cid.toString(),
									title: record.title,
									alt: record.alt,
									tags: record.tags ? JSON.stringify(record.tags) : null,
									file: record.file,
									createdAt,
								},
							})
							.run();
					} catch (err) {
						logger.error({ err }, "Failed to upsert GIF");
					}
				} else if (evt.event === "delete") {
					logger.info({ uri: evt.uri.toString() }, "Deleting GIF");
					try {
						// Use raw SQL for delete operation
						sqlite
							.prepare("DELETE FROM global_gifs WHERE uri = ?")
							.run(evt.uri.toString());
					} catch (err) {
						logger.error({ err }, "Failed to delete GIF");
					}
				}
			}
		},
		onError: (err) => {
			logger.error({ err }, "Firehose Error");
		},
		service: FIREHOSE_URL,
		excludeIdentity: true,
		excludeAccount: true,
	});

	logger.info("Starting Firehose...");
	firehose.start();
}

main().catch((err) => {
	console.error("Fatal Error:", err);
	process.exit(1);
});
