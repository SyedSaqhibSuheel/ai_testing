ALTER TABLE `scenarios` ADD COLUMN `application_id` text REFERENCES `applications`(`id`) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `test_runs` ADD `app_url` text;
