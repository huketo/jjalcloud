import type { StateStore, StoredState } from "@atcute/oauth-node-client";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { oauthStates } from "../db/schema";

export class PostgresStateStore implements StateStore {
	constructor(private db: Database) {}

	async get(key: string): Promise<StoredState | undefined> {
		const row = await this.db.query.oauthStates.findFirst({
			where: eq(oauthStates.key, key),
		});
		return row?.state as StoredState | undefined;
	}

	async set(key: string, state: StoredState): Promise<void> {
		await this.db
			.insert(oauthStates)
			.values({ key, state: state as unknown as Record<string, unknown> })
			.onConflictDoUpdate({
				target: oauthStates.key,
				set: {
					state: state as unknown as Record<string, unknown>,
					createdAt: new Date(),
				},
			});
	}

	async delete(key: string): Promise<void> {
		await this.db.delete(oauthStates).where(eq(oauthStates.key, key));
	}

	async clear(): Promise<void> {
		await this.db.delete(oauthStates);
	}
}
