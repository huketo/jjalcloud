import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const likes = sqliteTable("likes", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	subject: text("subject").notNull(), // URI of the subject (e.g. at://did:plc:123/app.bsky.feed.post/456)
	author: text("author").notNull(), // DID of the user who liked
	rkey: text("rkey").notNull(), // Record Key of the like itself
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const globalGifs = sqliteTable("global_gifs", {
	uri: text("uri").primaryKey(),
	cid: text("cid").notNull(),
	author: text("author").notNull(),
	title: text("title"),
	alt: text("alt"),
	tags: text("tags"), // Stored as JSON string or comma-separated
	file: text("file", { mode: "json" }).notNull(), // BlobRef stored as JSON
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
