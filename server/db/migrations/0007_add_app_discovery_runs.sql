CREATE TABLE `app_discovery_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`app_url` text NOT NULL,
	`status` text DEFAULT 'crawling' NOT NULL,
	`current_task` text DEFAULT 'Starting' NOT NULL,
	`logged_in` integer DEFAULT false NOT NULL,
	`discovered_routes` text DEFAULT '[]' NOT NULL,
	`discovered_flows` text DEFAULT '[]' NOT NULL,
	`pages` text DEFAULT '[]' NOT NULL,
	`skipped_urls` text DEFAULT '[]' NOT NULL,
	`requirement_ids` text DEFAULT '[]' NOT NULL,
	`error_message` text,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
