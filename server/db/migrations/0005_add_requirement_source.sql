ALTER TABLE `requirements` ADD `source` text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE `requirements` ADD `source_module` text;
