import type { SessionStore, StoredSession } from "@atcute/oauth-node-client";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { oauthSessions } from "../db/schema";

export class PostgresSessionStore implements SessionStore {
	constructor(private db: Database) {}

	async get(did: string): Promise<StoredSession | undefined> {
		const row = await this.db.query.oauthSessions.findFirst({
			where: eq(oauthSessions.did, did),
		});
		return row?.session as StoredSession | undefined;
	}

	async set(did: string, session: StoredSession): Promise<void> {
		await this.db
			.insert(oauthSessions)
			.values({ did, session: session as unknown as Record<string, unknown> })
			.onConflictDoUpdate({
				target: oauthSessions.did,
				set: {
					session: session as unknown as Record<string, unknown>,
					updatedAt: new Date(),
				},
			});
	}

	async delete(did: string): Promise<void> {
		await this.db.delete(oauthSessions).where(eq(oauthSessions.did, did));
	}

	async clear(): Promise<void> {
		await this.db.delete(oauthSessions);
	}
}
