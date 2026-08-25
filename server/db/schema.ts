import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const timestamp = (name: string) => integer(name, { mode: "timestamp" });
const json = <T = unknown>(name: string) => text(name, { mode: "json" }).$type<T>();

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export type RequirementStatus =
  | "submitted"
  | "analyzing"
  | "awaiting_scenario_approval"
  | "planning"
  | "awaiting_plan_approval"
  | "generating_tests"
  | "awaiting_test_approval"
  | "committed"
  | "failed";

export const requirements = sqliteTable("requirements", {
  id: id(),
  title: text("title").notNull(),
  rawText: text("raw_text").notNull(),
  submittedBy: text("submitted_by").notNull(),
  status: text("status").$type<RequirementStatus>().notNull().default("submitted"),
  currentAnalysisId: text("current_analysis_id"),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// AI Testing Intelligence Layer output
// ---------------------------------------------------------------------------

export interface FunctionalRequirement {
  description: string;
}
export interface RiskArea {
  area: string;
  reason: string;
}

export const requirementAnalyses = sqliteTable("requirement_analyses", {
  id: id(),
  requirementId: text("requirement_id").notNull().references(() => requirements.id),
  agentRunId: text("agent_run_id"),
  functionalRequirements: json<FunctionalRequirement[]>("functional_requirements").notNull(),
  userRoles: json<string[]>("user_roles").notNull(),
  validationRules: json<string[]>("validation_rules").notNull(),
  riskAreas: json<RiskArea[]>("risk_areas").notNull(),
  suggestedCoverage: json<string[]>("suggested_coverage").notNull(),
  rawModelOutput: json("raw_model_output"),
  status: text("status").$type<"pending" | "completed" | "failed">().notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// Scenarios - the core entity, with two human approval gates in its status
// ---------------------------------------------------------------------------

export type ScenarioStatus =
  | "ai_proposed"
  | "approved"
  | "rejected"
  | "grounding_in_progress"
  | "grounded_pending_review"
  | "approved_for_generation";

export const scenarios = sqliteTable("scenarios", {
  id: id(),
  requirementId: text("requirement_id").notNull().references(() => requirements.id),
  analysisId: text("analysis_id"),
  sourceType: text("source_type").$type<"ai_generated" | "user_added">().notNull().default("ai_generated"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").$type<"low" | "medium" | "high" | "critical">().notNull().default("medium"),
  riskLevel: text("risk_level").$type<"low" | "medium" | "high">().notNull().default("medium"),
  preconditions: json<string[]>("preconditions").notNull().default([]),
  draftSteps: json<string[]>("draft_steps").notNull().default([]),
  groundedPlan: json("grounded_plan"),
  expectedResult: text("expected_result").notNull(),
  aiConfidence: real("ai_confidence"),
  status: text("status").$type<ScenarioStatus>().notNull().default("ai_proposed"),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// Playwright Planner - live exploration findings
// ---------------------------------------------------------------------------

export interface DiscoveredTestId {
  testId: string;
  component?: string;
  source: "static" | "live" | "both";
}

export const explorationRuns = sqliteTable("exploration_runs", {
  id: id(),
  requirementId: text("requirement_id").notNull().references(() => requirements.id),
  agentRunId: text("agent_run_id"),
  discoveredRoutes: json<string[]>("discovered_routes").notNull().default([]),
  discoveredTestIds: json<DiscoveredTestId[]>("discovered_test_ids").notNull().default([]),
  discoveredFlows: json<string[]>("discovered_flows").notNull().default([]),
  crossReferenceNotes: json<string[]>("cross_reference_notes").notNull().default([]),
  screenshotPaths: json<string[]>("screenshot_paths").notNull().default([]),
  rawTranscript: json("raw_transcript"),
  status: text("status").$type<"running" | "completed" | "failed" | "timeout">().notNull().default("running"),
  startedAt: timestamp("started_at").notNull().$defaultFn(() => new Date()),
  finishedAt: timestamp("finished_at"),
});

// ---------------------------------------------------------------------------
// Playwright Generator output
// ---------------------------------------------------------------------------

export type TestFileStatus =
  | "generating"
  | "syntax_valid"
  | "syntax_invalid"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "committed";

export const testFiles = sqliteTable("test_files", {
  id: id(),
  requirementId: text("requirement_id").notNull().references(() => requirements.id),
  filePath: text("file_path").notNull(),
  version: integer("version").notNull().default(1),
  code: text("code").notNull(),
  status: text("status").$type<TestFileStatus>().notNull().default("generating"),
  validationError: text("validation_error"),
  generatedByAgentRunId: text("generated_by_agent_run_id"),
  isLatest: integer("is_latest", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
});

export const testFileScenarios = sqliteTable("test_file_scenarios", {
  id: id(),
  testFileId: text("test_file_id").notNull().references(() => testFiles.id),
  scenarioId: text("scenario_id").notNull().references(() => scenarios.id),
  testTitle: text("test_title").notNull(),
  testBlockStartLine: integer("test_block_start_line"),
});

// ---------------------------------------------------------------------------
// Git integration (local commits only, Phase 1)
// ---------------------------------------------------------------------------

export const gitCommits = sqliteTable("git_commits", {
  id: id(),
  commitSha: text("commit_sha").notNull(),
  branch: text("branch").notNull(),
  message: text("message").notNull(),
  author: text("author").notNull(),
  prStatus: text("pr_status").$type<"not_created">().notNull().default("not_created"),
  committedAt: timestamp("committed_at").notNull().$defaultFn(() => new Date()),
});

export const gitCommitFiles = sqliteTable("git_commit_files", {
  id: id(),
  commitId: text("commit_id").notNull().references(() => gitCommits.id),
  testFileId: text("test_file_id").notNull().references(() => testFiles.id),
  filePathAtCommit: text("file_path_at_commit").notNull(),
});

// ---------------------------------------------------------------------------
// Test execution - runs the committed Playwright test for real (no AI - just
// `npx playwright test`) and stores the report so the dashboard can show
// pass/fail/duration/errors/screenshots/traces/history without needing
// GitHub Actions polling. Complements (doesn't replace) the real
// .github/workflows/playwright.yml committed into the managed repo.
// ---------------------------------------------------------------------------

export type TestRunStatus = "running" | "passed" | "failed" | "error";
export type TestRunTrigger = "manual" | "auto_after_commit";

export const testRuns = sqliteTable("test_runs", {
  id: id(),
  testFileId: text("test_file_id").notNull().references(() => testFiles.id),
  triggeredBy: text("triggered_by").$type<TestRunTrigger>().notNull(),
  status: text("status").$type<TestRunStatus>().notNull().default("running"),
  startedAt: timestamp("started_at").notNull().$defaultFn(() => new Date()),
  finishedAt: timestamp("finished_at"),
  durationMs: integer("duration_ms"),
  totalTests: integer("total_tests"),
  passedCount: integer("passed_count"),
  failedCount: integer("failed_count"),
  skippedCount: integer("skipped_count"),
  artifactsDir: text("artifacts_dir"),
  errorMessage: text("error_message"),
});

export const testRunCases = sqliteTable("test_run_cases", {
  id: id(),
  testRunId: text("test_run_id").notNull().references(() => testRuns.id),
  suiteTitle: text("suite_title"),
  title: text("title").notNull(),
  status: text("status").$type<"passed" | "failed" | "timedOut" | "skipped" | "interrupted">().notNull(),
  durationMs: integer("duration_ms").notNull(),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  screenshotPath: text("screenshot_path"),
  tracePath: text("trace_path"),
  stdout: json<string[]>("stdout").notNull().default([]),
  stderr: json<string[]>("stderr").notNull().default([]),
});

// ---------------------------------------------------------------------------
// Agent activity - generic log powering both live status and history
// ---------------------------------------------------------------------------

export type AgentType = "intelligence" | "planner" | "generator";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export const agentRuns = sqliteTable("agent_runs", {
  id: id(),
  agentType: text("agent_type").$type<AgentType>().notNull(),
  requirementId: text("requirement_id").notNull().references(() => requirements.id),
  scenarioId: text("scenario_id"),
  status: text("status").$type<AgentRunStatus>().notNull().default("queued"),
  currentTask: text("current_task").notNull().default("Waiting"),
  input: json("input"),
  output: json("output"),
  startedAt: timestamp("started_at").notNull().$defaultFn(() => new Date()),
  finishedAt: timestamp("finished_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  parentRunId: text("parent_run_id"),
});

// ---------------------------------------------------------------------------
// Approval audit trail
// ---------------------------------------------------------------------------

export const approvalAuditLog = sqliteTable("approval_audit_log", {
  id: id(),
  entityType: text("entity_type").$type<"scenario" | "test_file" | "git_commit">().notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").$type<"approved" | "rejected" | "regenerate_requested" | "edited" | "deleted" | "auto_approved">().notNull(),
  actorType: text("actor_type").$type<"human" | "system_auto">().notNull(),
  actor: text("actor").notNull(),
  reason: text("reason"),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// Settings - non-secret operational knobs only. Secrets stay in .env.
// ---------------------------------------------------------------------------

export type ApprovalMode = "manual" | "semi_automatic" | "fully_automatic";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
});
