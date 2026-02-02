CREATE TABLE `global_gifs` (
	`uri` text PRIMARY KEY NOT NULL,
	`cid` text NOT NULL,
	`author` text NOT NULL,
	`title` text,
	`alt` text,
	`tags` text,
	`file` text NOT NULL,
	`created_at` integer NOT NULL
);
