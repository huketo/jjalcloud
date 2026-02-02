CREATE TABLE `likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject` text NOT NULL,
	`author` text NOT NULL,
	`rkey` text NOT NULL,
	`created_at` integer DEFAULT '"2026-01-30T02:50:24.709Z"' NOT NULL
);
