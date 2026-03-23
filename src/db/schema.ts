import { relations } from "drizzle-orm";
import {
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// Custom tsvector type for full-text search
const tsvector = customType<{ data: string }>({
	dataType() {
		return "tsvector";
	},
});

export const users = pgTable("users", {
	did: text("did").primaryKey(),
	handle: text("handle").notNull(),
	displayName: text("display_name"),
	avatar: text("avatar"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const gifs = pgTable(
	"gifs",
	{
		uri: text("uri").primaryKey(),
		cid: text("cid").notNull(),
		author: text("author")
			.notNull()
			.references(() => users.did),
		rkey: text("rkey").notNull(),
		title: text("title"),
		alt: text("alt"),
		width: integer("width"),
		height: integer("height"),
		file: jsonb("file").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		indexedAt: timestamp("indexed_at", { withTimezone: true }).defaultNow().notNull(),
		searchVector: tsvector("search_vector"),
	},
	(table) => [
		uniqueIndex("gifs_author_rkey_idx").on(table.author, table.rkey),
		index("gifs_created_at_idx").on(table.createdAt),
		index("gifs_author_idx").on(table.author),
	],
);

export const tags = pgTable(
	"tags",
	{
		id: serial("id").primaryKey(),
		gifUri: text("gif_uri")
			.notNull()
			.references(() => gifs.uri, { onDelete: "cascade" }),
		name: text("name").notNull(),
	},
	(table) => [index("tags_name_idx").on(table.name), index("tags_gif_uri_idx").on(table.gifUri)],
);

export const likes = pgTable(
	"likes",
	{
		id: serial("id").primaryKey(),
		subject: text("subject").notNull(),
		author: text("author").notNull(),
		rkey: text("rkey").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		uniqueIndex("likes_author_rkey_idx").on(table.author, table.rkey),
		index("likes_subject_idx").on(table.subject),
	],
);

export const categories = pgTable("categories", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
	searchterm: text("searchterm").notNull(),
	imageUrl: text("image_url"),
	position: integer("position").default(0),
});

export const shareEvents = pgTable(
	"share_events",
	{
		id: serial("id").primaryKey(),
		gifUri: text("gif_uri")
			.notNull()
			.references(() => gifs.uri, { onDelete: "cascade" }),
		clientKey: text("client_key"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("share_events_gif_uri_idx").on(table.gifUri)],
);

export const oauthStates = pgTable("oauth_states", {
	key: text("key").primaryKey(),
	state: jsonb("state").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const oauthSessions = pgTable("oauth_sessions", {
	did: text("did").primaryKey(),
	session: jsonb("session").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const gifsRelations = relations(gifs, ({ many }) => ({
	tags: many(tags),
	likes: many(likes),
	shareEvents: many(shareEvents),
}));

export const tagsRelations = relations(tags, ({ one }) => ({
	gif: one(gifs, { fields: [tags.gifUri], references: [gifs.uri] }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
	gif: one(gifs, { fields: [likes.subject], references: [gifs.uri] }),
}));

export const shareEventsRelations = relations(shareEvents, ({ one }) => ({
	gif: one(gifs, { fields: [shareEvents.gifUri], references: [gifs.uri] }),
}));
