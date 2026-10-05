ALTER TABLE `applications` ADD `app_base_url` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `api_base_url` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `backend_src_dir` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `frontend_src_dir` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `frontend_server_src_dir` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `login_username` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `login_password` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `login_username_locator` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `login_password_locator` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `login_submit_locator` text;--> statement-breakpoint
ALTER TABLE `requirements` ADD `application_id` text REFERENCES applications(id);