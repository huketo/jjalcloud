import type { Record as GifRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/gif";
import type { Record as LikeRecord } from "@jjalcloud/common/lexicon/types/com/jjalcloud/feed/like";
import pino from "pino";
import { backfill, parseDids } from "./backfill.js";
import { EventBatcher } from "./batcher.js";
import {
	createLocalDatabase,
	createRemoteDatabase,
	type DatabaseClient,
} from "./db/index.js";
import { env, isProduction } from "./env.js";
import { JetstreamClient, type JetstreamCommitEvent } from "./jetstream.js";

type Command = "start" | "backfill";

function parseArgs(): { command: Command; dids?: string; pds?: string } {
	const args = process.argv.slice(2);
	const command = (args[0] as Command) || "start";

	let dids: string | undefined;
	let pds: string | undefined;

	for (let i = 1; i < args.length; i++) {
		if (args[i] === "--dids" && args[i + 1]) {
			dids = args[i + 1];
			i++;
		} else if (args[i] === "--pds" && args[i + 1]) {
			pds = args[i + 1];
			i++;
		}
	}

	return { command, dids, pds };
}

function printUsage() {
	console.log(`
Usage: indexer <command> [options]

Commands:
  start              Start the real-time Jetstream indexer (default)
  backfill           Backfill existing records from AT Protocol repos

Options for backfill:
  --dids <did1,did2> Comma-separated list of DIDs to backfill
                     If not provided, backfills all authors found in the database
  --pds <url>        PDS URL to fetch records from (default: https://bsky.social)

Examples:
  pnpm start                          # Start real-time indexer
  pnpm backfill                       # Backfill all known authors from DB
  pnpm backfill --dids did:plc:xxx    # Backfill specific user
  pnpm backfill --dids did:plc:xxx,did:plc:yyy --pds https://custom.pds
`);
}

async function main() {
	const { command, dids, pds } = parseArgs();

	if (command !== "start" && command !== "backfill") {
		printUsage();
		process.exit(1);
	}

	const logger = pino({ name: "indexer", level: env.LOG_LEVEL });

	// Initialize database based on environment
	let dbClient: DatabaseClient;

	if (isProduction) {
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		const databaseId = env.CLOUDFLARE_DATABASE_ID;
		const apiToken = env.CLOUDFLARE_API_TOKEN;

		if (!accountId || !databaseId || !apiToken) {
			throw new Error(
				"Production mode requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_API_TOKEN",
			);
		}

		logger.info("Running in PRODUCTION mode - connecting to Cloudflare D1");
		dbClient = createRemoteDatabase(
			{
				accountId,
				databaseId,
				apiToken,
			},
			logger,
		);
	} else {
		logger.info("Running in DEVELOPMENT mode - using local D1 database");
		dbClient = createLocalDatabase({
			logger,
			dbPath: env.LOCAL_DB_PATH,
		});
	}

	const { db } = dbClient;

	// Execute command
	if (command === "backfill") {
		logger.info("Starting backfill...");
		await backfill({
			db,
			logger,
			dids: parseDids(dids),
			pdsUrl: pds,
		});
		logger.info("Backfill finished");
		return;
	}

	// Default: start Jetstream indexer
	const WANTED_COLLECTIONS = [
		"com.jjalcloud.feed.like",
		"com.jjalcloud.feed.gif",
	];

	const batcher = new EventBatcher({
		executeBatch: dbClient.executeBatch,
		logger,
	});

	const handleCommitEvent = (evt: JetstreamCommitEvent) => {
		const { commit, did } = evt;
		const { operation, collection, rkey } = commit;
		const uri = `at://${did}/${collection}/${rkey}`;

		if (collection === "com.jjalcloud.feed.like") {
			if (operation === "create" || operation === "update") {
				const record = commit.record as unknown as LikeRecord;
				const subjectUri = record.subject?.uri as string | undefined;

				if (subjectUri && did) {
					logger.info({ uri, author: did }, "Queuing Like");
					const createdAt = record.createdAt
						? new Date(record.createdAt)
						: new Date();

					batcher.queueLikeInsert({
						subject: subjectUri,
						author: did,
						rkey,
						createdAt,
					});
				}
			} else if (operation === "delete") {
				logger.info({ uri }, "Queuing Like Delete");
				batcher.queueLikeDelete(rkey, did);
			}
		}

		if (collection === "com.jjalcloud.feed.gif") {
			if (operation === "create" || operation === "update") {
				const record = commit.record as unknown as GifRecord;
				logger.info({ uri }, "Queuing GIF");

				const createdAt = record.createdAt
					? new Date(record.createdAt)
					: new Date();

				batcher.queueGifUpsert({
					uri,
					cid: commit.cid ?? "",
					author: did,
					title: record.title,
					alt: record.alt,
					tags: record.tags,
					file: record.file,
					width: record.width,
					height: record.height,
					createdAt,
				});
			} else if (operation === "delete") {
				logger.info({ uri }, "Queuing GIF Delete");
				batcher.queueGifDelete(uri);
			}
		}
	};

	const jetstream = new JetstreamClient({
		url: env.JETSTREAM_URL,
		wantedCollections: WANTED_COLLECTIONS,
		handleEvent: handleCommitEvent,
		onError: (err) => {
			logger.error({ err }, "Jetstream Error");
		},
		logger,
	});

	const shutdown = async () => {
		logger.info("Shutting down...");
		jetstream.destroy();
		await batcher.stop();
		logger.info("Shutdown complete");
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	logger.info(
		{
			mode: isProduction ? "production" : "development",
			collections: WANTED_COLLECTIONS,
		},
		"Starting Jetstream indexer...",
	);
	batcher.start();
	jetstream.start();
}

main().catch((err) => {
	console.error("Fatal Error:", err);
	process.exit(1);
});
