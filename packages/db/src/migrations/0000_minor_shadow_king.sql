CREATE TABLE `tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`hidden_from_loop` integer DEFAULT false NOT NULL,
	`conditions` text,
	`position` integer DEFAULT 0 NOT NULL
);
