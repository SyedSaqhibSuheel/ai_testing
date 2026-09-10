ALTER TABLE `test_run_cases` ADD `classification` text;--> statement-breakpoint
ALTER TABLE `test_run_cases` ADD `classification_confidence` real;--> statement-breakpoint
ALTER TABLE `test_run_cases` ADD `classification_evidence_kind` text;--> statement-breakpoint
ALTER TABLE `test_run_cases` ADD `classification_evidence` text;--> statement-breakpoint
ALTER TABLE `test_run_cases` ADD `classification_reasoning` text;--> statement-breakpoint
ALTER TABLE `test_run_cases` ADD `suggested_fix` text;