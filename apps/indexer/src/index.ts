import { IdResolver } from "@atproto/identity";
import type { Event } from "@atproto/sync";
import { Firehose } from "@atproto/sync";
import type { Record as GifRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/gif";
import type { Record as LikeRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/like";
import pino from "pino";
import {
	createLocalDatabase,
	createRemoteDatabase,
	type Database,
	dbOperations,
} from "./db/index.js";
import { env, isProduction } from "./env.js";

async function main() {
	const logger = pino({ name: "firehose", level: env.LOG_LEVEL });

	// Initialize database based on environment
	let db: Database;

	if (isProduction) {
		const {
			CLOUDFLARE_ACCOUNT_ID,
			CLOUDFLARE_DATABASE_ID,
			CLOUDFLARE_API_TOKEN,
		} = env;

		if (
			!CLOUDFLARE_ACCOUNT_ID ||
			!CLOUDFLARE_DATABASE_ID ||
			!CLOUDFLARE_API_TOKEN
		) {
			throw new Error(
				"Missing Cloudflare configuration - CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_API_TOKEN are required in production",
			);
		}

		logger.info("Running in PRODUCTION mode - connecting to Cloudflare D1");
		db = createRemoteDatabase(
			{
				accountId: CLOUDFLARE_ACCOUNT_ID,
				databaseId: CLOUDFLARE_DATABASE_ID,
				apiToken: CLOUDFLARE_API_TOKEN,
			},
			logger,
		);
	} else {
		logger.info("Running in DEVELOPMENT mode - using local D1 database");
		db = createLocalDatabase(logger);
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

							await dbOperations.insertLike(db, {
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
						await dbOperations.deleteLike(db, evt.rkey, evt.did);
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

						await dbOperations.upsertGif(db, {
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
						await dbOperations.deleteGif(db, evt.uri.toString());
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
