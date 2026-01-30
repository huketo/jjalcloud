import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const likes = sqliteTable("likes", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	subject: text("subject").notNull(), // URI of the subject (e.g. at://did:plc:123/app.bsky.feed.post/456)
	author: text("author").notNull(), // DID of the user who liked
	rkey: text("rkey").notNull(), // Record Key of the like itself
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});
