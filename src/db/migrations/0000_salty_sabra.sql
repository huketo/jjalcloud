CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"searchterm" text NOT NULL,
	"image_url" text,
	"position" integer DEFAULT 0,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "gifs" (
	"uri" text PRIMARY KEY NOT NULL,
	"cid" text NOT NULL,
	"author" text NOT NULL,
	"rkey" text NOT NULL,
	"title" text,
	"alt" text,
	"width" integer,
	"height" integer,
	"file" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector"
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"author" text NOT NULL,
	"rkey" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_sessions" (
	"did" text PRIMARY KEY NOT NULL,
	"session" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"key" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"gif_uri" text NOT NULL,
	"client_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"gif_uri" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"did" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "gifs" ADD CONSTRAINT "gifs_author_users_did_fk" FOREIGN KEY ("author") REFERENCES "public"."users"("did") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_gif_uri_gifs_uri_fk" FOREIGN KEY ("gif_uri") REFERENCES "public"."gifs"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_gif_uri_gifs_uri_fk" FOREIGN KEY ("gif_uri") REFERENCES "public"."gifs"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gifs_author_rkey_idx" ON "gifs" USING btree ("author","rkey");--> statement-breakpoint
CREATE INDEX "gifs_created_at_idx" ON "gifs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "gifs_author_idx" ON "gifs" USING btree ("author");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_author_rkey_idx" ON "likes" USING btree ("author","rkey");--> statement-breakpoint
CREATE INDEX "likes_subject_idx" ON "likes" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "share_events_gif_uri_idx" ON "share_events" USING btree ("gif_uri");--> statement-breakpoint
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tags_gif_uri_idx" ON "tags" USING btree ("gif_uri");