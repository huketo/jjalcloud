import { JetstreamSubscription } from "@atcute/jetstream";
import type { Database } from "../db/client";
import { env } from "../env";
import type { ComJjalcloudFeedGif, ComJjalcloudFeedLike } from "../lexicon";
import { handleGifCreate, handleGifDelete, handleLikeCreate, handleLikeDelete } from "./handlers";

const COLLECTIONS = ["com.jjalcloud.feed.gif", "com.jjalcloud.feed.like"] as const;

async function processEvents(db: Database, jetstream: JetstreamSubscription): Promise<void> {
	for await (const event of jetstream) {
		if (event.kind !== "commit") continue;

		const { did, commit } = event;
		const { collection, rkey } = commit;

		try {
			if (collection === "com.jjalcloud.feed.gif") {
				const uri = `at://${did}/com.jjalcloud.feed.gif/${rkey}`;
				if (commit.operation === "create" || commit.operation === "update") {
					await handleGifCreate(
						db,
						uri,
						commit.cid,
						did,
						rkey,
						commit.record as ComJjalcloudFeedGif.Main,
					);
				} else if (commit.operation === "delete") {
					await handleGifDelete(db, uri);
				}
			} else if (collection === "com.jjalcloud.feed.like") {
				if (commit.operation === "create") {
					await handleLikeCreate(db, did, rkey, commit.record as ComJjalcloudFeedLike.Main);
				} else if (commit.operation === "delete") {
					await handleLikeDelete(db, did, rkey);
				}
			}
		} catch (e) {
			console.error(`[indexer] Error processing ${collection} event:`, e);
		}
	}
}

export function startJetstream(db: Database): void {
	const urls = env.JETSTREAM_URLS;
	let urlIndex = 0;

	void (async () => {
		while (true) {
			const url = urls[urlIndex % urls.length]!;
			console.log(`[indexer] Connecting to Jetstream: ${url}`);

			const jetstream = new JetstreamSubscription({
				url,
				wantedCollections: [...COLLECTIONS],
			});

			try {
				await processEvents(db, jetstream);
			} catch (e) {
				console.error(`[indexer] Jetstream connection failed (${url}):`, e);
				urlIndex++;
				const nextUrl = urls[urlIndex % urls.length]!;
				console.log(`[indexer] Falling back to ${nextUrl} in 5s...`);
				await new Promise((r) => setTimeout(r, 5000));
			}
		}
	})();
}
