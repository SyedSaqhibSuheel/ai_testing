CREATE TABLE `test_run_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`test_run_id` text NOT NULL,
	`suite_title` text,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`error_message` text,
	`error_stack` text,
	`screenshot_path` text,
	`trace_path` text,
	`stdout` text DEFAULT '[]' NOT NULL,
	`stderr` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`test_run_id`) REFERENCES `test_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `test_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`test_file_id` text NOT NULL,
	`triggered_by` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`duration_ms` integer,
	`total_tests` integer,
	`passed_count` integer,
	`failed_count` integer,
	`skipped_count` integer,
	`artifacts_dir` text,
	`error_message` text,
	FOREIGN KEY (`test_file_id`) REFERENCES `test_files`(`id`) ON UPDATE no action ON DELETE no action
);
