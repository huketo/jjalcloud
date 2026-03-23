import { JetstreamSubscription } from "@atcute/jetstream";
import type { Database } from "../db/client";
import { env } from "../env";
import { handleGifCreate, handleGifDelete, handleLikeCreate, handleLikeDelete } from "./handlers";

const COLLECTIONS = ["com.jjalcloud.feed.gif", "com.jjalcloud.feed.like"] as const;

export function startJetstream(db: Database): JetstreamSubscription {
	const jetstream = new JetstreamSubscription({
		url: env.JETSTREAM_URL,
		wantedCollections: [...COLLECTIONS],
	});

	void (async () => {
		for await (const event of jetstream) {
			if (event.kind !== "commit") continue;

			const { did, commit } = event;
			const { collection, rkey } = commit;

			if (collection === "com.jjalcloud.feed.gif") {
				const uri = `at://${did}/com.jjalcloud.feed.gif/${rkey}`;
				if (commit.operation === "create" || commit.operation === "update") {
					await handleGifCreate(db, uri, commit.cid, did, rkey, commit.record as any);
				} else if (commit.operation === "delete") {
					await handleGifDelete(db, uri);
				}
			} else if (collection === "com.jjalcloud.feed.like") {
				if (commit.operation === "create") {
					await handleLikeCreate(db, did, rkey, commit.record as any);
				} else if (commit.operation === "delete") {
					await handleLikeDelete(db, did, rkey);
				}
			}
		}
	})();

	console.log("[indexer] Jetstream connected");
	return jetstream;
}
