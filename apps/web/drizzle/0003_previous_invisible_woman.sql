CREATE TABLE `users` (
	`did` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`display_name` text,
	`avatar` text,
	`created_at` integer NOT NULL,
	`last_login_at` integer NOT NULL
);
