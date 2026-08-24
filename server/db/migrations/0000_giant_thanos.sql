CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_type` text NOT NULL,
	`requirement_id` text NOT NULL,
	`scenario_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`current_task` text DEFAULT 'Waiting' NOT NULL,
	`input` text,
	`output` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`parent_run_id` text,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor` text NOT NULL,
	`reason` text,
	`previous_status` text,
	`new_status` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exploration_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`requirement_id` text NOT NULL,
	`agent_run_id` text,
	`discovered_routes` text DEFAULT '[]' NOT NULL,
	`discovered_test_ids` text DEFAULT '[]' NOT NULL,
	`discovered_flows` text DEFAULT '[]' NOT NULL,
	`cross_reference_notes` text DEFAULT '[]' NOT NULL,
	`screenshot_paths` text DEFAULT '[]' NOT NULL,
	`raw_transcript` text,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `git_commit_files` (
	`id` text PRIMARY KEY NOT NULL,
	`commit_id` text NOT NULL,
	`test_file_id` text NOT NULL,
	`file_path_at_commit` text NOT NULL,
	FOREIGN KEY (`commit_id`) REFERENCES `git_commits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`test_file_id`) REFERENCES `test_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `git_commits` (
	`id` text PRIMARY KEY NOT NULL,
	`commit_sha` text NOT NULL,
	`branch` text NOT NULL,
	`message` text NOT NULL,
	`author` text NOT NULL,
	`pr_status` text DEFAULT 'not_created' NOT NULL,
	`committed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `requirement_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`requirement_id` text NOT NULL,
	`agent_run_id` text,
	`functional_requirements` text NOT NULL,
	`user_roles` text NOT NULL,
	`validation_rules` text NOT NULL,
	`risk_areas` text NOT NULL,
	`suggested_coverage` text NOT NULL,
	`raw_model_output` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`raw_text` text NOT NULL,
	`submitted_by` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`current_analysis_id` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`requirement_id` text NOT NULL,
	`analysis_id` text,
	`source_type` text DEFAULT 'ai_generated' NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`risk_level` text DEFAULT 'medium' NOT NULL,
	`preconditions` text DEFAULT '[]' NOT NULL,
	`draft_steps` text DEFAULT '[]' NOT NULL,
	`grounded_plan` text,
	`expected_result` text NOT NULL,
	`ai_confidence` real,
	`status` text DEFAULT 'ai_proposed' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`rejected_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_file_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`test_file_id` text NOT NULL,
	`scenario_id` text NOT NULL,
	`test_title` text NOT NULL,
	`test_block_start_line` integer,
	FOREIGN KEY (`test_file_id`) REFERENCES `test_files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `test_files` (
	`id` text PRIMARY KEY NOT NULL,
	`requirement_id` text NOT NULL,
	`file_path` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`validation_error` text,
	`generated_by_agent_run_id` text,
	`is_latest` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	`approved_by` text,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE no action
);
