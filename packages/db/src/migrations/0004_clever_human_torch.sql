CREATE TABLE `time_ranges` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`days_of_week` text
);
