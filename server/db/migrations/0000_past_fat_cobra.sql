CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_type" text NOT NULL,
	"requirement_id" text NOT NULL,
	"scenario_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"current_task" text DEFAULT 'Waiting' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"parent_run_id" text
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "applications_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "approval_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text,
	"previous_status" text,
	"new_status" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exploration_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"requirement_id" text NOT NULL,
	"agent_run_id" text,
	"discovered_routes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discovered_test_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discovered_flows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cross_reference_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screenshot_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_transcript" jsonb,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "git_commit_files" (
	"id" text PRIMARY KEY NOT NULL,
	"commit_id" text NOT NULL,
	"test_file_id" text NOT NULL,
	"file_path_at_commit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "git_commits" (
	"id" text PRIMARY KEY NOT NULL,
	"commit_sha" text NOT NULL,
	"branch" text NOT NULL,
	"message" text NOT NULL,
	"author" text NOT NULL,
	"pr_status" text DEFAULT 'not_created' NOT NULL,
	"committed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"requirement_id" text NOT NULL,
	"agent_run_id" text,
	"functional_requirements" jsonb NOT NULL,
	"user_roles" jsonb NOT NULL,
	"validation_rules" jsonb NOT NULL,
	"risk_areas" jsonb NOT NULL,
	"suggested_coverage" jsonb NOT NULL,
	"raw_model_output" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"raw_text" text NOT NULL,
	"submitted_by" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"current_analysis_id" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_module" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"requirement_id" text NOT NULL,
	"application_id" text,
	"analysis_id" text,
	"source_type" text DEFAULT 'ai_generated' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"preconditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grounded_plan" jsonb,
	"expected_result" text NOT NULL,
	"ai_confidence" real,
	"status" text DEFAULT 'ai_proposed' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"rejected_reason" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_file_scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"test_file_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"test_title" text NOT NULL,
	"test_block_start_line" integer
);
--> statement-breakpoint
CREATE TABLE "test_files" (
	"id" text PRIMARY KEY NOT NULL,
	"requirement_id" text NOT NULL,
	"file_path" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"validation_error" text,
	"generated_by_agent_run_id" text,
	"is_latest" boolean DEFAULT true NOT NULL,
	"auto_run_on_commit" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"approved_at" timestamp,
	"approved_by" text
);
--> statement-breakpoint
CREATE TABLE "test_run_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"test_run_id" text NOT NULL,
	"suite_title" text,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"error_message" text,
	"error_stack" text,
	"screenshot_path" text,
	"trace_path" text,
	"stdout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stderr" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classification" text,
	"classification_confidence" real,
	"classification_evidence_kind" text,
	"classification_evidence" jsonb,
	"classification_reasoning" text,
	"suggested_fix" text
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"test_file_id" text NOT NULL,
	"triggered_by" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer,
	"total_tests" integer,
	"passed_count" integer,
	"failed_count" integer,
	"skipped_count" integer,
	"artifacts_dir" text,
	"error_message" text,
	"app_url" text
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_runs" ADD CONSTRAINT "exploration_runs_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_commit_files" ADD CONSTRAINT "git_commit_files_commit_id_git_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."git_commits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_commit_files" ADD CONSTRAINT "git_commit_files_test_file_id_test_files_id_fk" FOREIGN KEY ("test_file_id") REFERENCES "public"."test_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analyses" ADD CONSTRAINT "requirement_analyses_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_file_scenarios" ADD CONSTRAINT "test_file_scenarios_test_file_id_test_files_id_fk" FOREIGN KEY ("test_file_id") REFERENCES "public"."test_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_file_scenarios" ADD CONSTRAINT "test_file_scenarios_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_files" ADD CONSTRAINT "test_files_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run_cases" ADD CONSTRAINT "test_run_cases_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_test_file_id_test_files_id_fk" FOREIGN KEY ("test_file_id") REFERENCES "public"."test_files"("id") ON DELETE no action ON UPDATE no action;