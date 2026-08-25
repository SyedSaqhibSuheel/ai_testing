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

export interface Requirement {
  id: string;
  title: string;
  rawText: string;
  submittedBy: string;
  status: RequirementStatus;
  currentAnalysisId: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementAnalysis {
  id: string;
  requirementId: string;
  functionalRequirements: { description: string }[];
  userRoles: string[];
  validationRules: string[];
  riskAreas: { area: string; reason: string }[];
  suggestedCoverage: string[];
  status: string;
  createdAt: string;
}

export type ScenarioStatus =
  | "ai_proposed"
  | "approved"
  | "rejected"
  | "grounding_in_progress"
  | "grounded_pending_review"
  | "approved_for_generation";

export interface GroundedStep {
  index: number;
  action: string;
  targetTestId?: string;
  targetRoute?: string;
  inputValue?: string;
  notes?: string;
}

export interface GroundedPlan {
  id: string;
  title: string;
  requirementRef: string;
  preconditions: string[];
  steps: GroundedStep[];
  expectedBackendCalls: { method: string; path: string; expectedStatus?: number }[];
  expectedUiOutcomes: string[];
  passCriteria: string[];
}

export interface Scenario {
  id: string;
  requirementId: string;
  analysisId: string | null;
  sourceType: "ai_generated" | "user_added";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  riskLevel: "low" | "medium" | "high";
  preconditions: string[];
  draftSteps: string[];
  groundedPlan: GroundedPlan | null;
  expectedResult: string;
  aiConfidence: number | null;
  status: ScenarioStatus;
  isDeleted: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredTestId {
  testId: string;
  component?: string;
  source: "static" | "live" | "both";
}

export interface ExplorationRun {
  id: string;
  requirementId: string;
  discoveredRoutes: string[];
  discoveredTestIds: DiscoveredTestId[];
  discoveredFlows: string[];
  crossReferenceNotes: string[];
  screenshotPaths: string[];
  status: "running" | "completed" | "failed" | "timeout";
  startedAt: string;
  finishedAt: string | null;
}

export type TestFileStatus = "generating" | "syntax_valid" | "syntax_invalid" | "pending_approval" | "approved" | "rejected" | "committed";

export interface TestFile {
  id: string;
  requirementId: string;
  filePath: string;
  version: number;
  code: string;
  status: TestFileStatus;
  validationError: string | null;
  generatedByAgentRunId: string | null;
  isLatest: boolean;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface TestFileScenarioMapping {
  id: string;
  testFileId: string;
  scenarioId: string;
  testTitle: string;
}

export type AgentType = "intelligence" | "planner" | "generator";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AgentRun {
  id: string;
  agentType: AgentType;
  requirementId: string;
  scenarioId: string | null;
  status: AgentRunStatus;
  currentTask: string;
  input: unknown;
  output: unknown;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  parentRunId: string | null;
}

export type ApprovalMode = "manual" | "semi_automatic" | "fully_automatic";

export interface MaskedSettings {
  approvalMode: ApprovalMode;
  llmProvider: string;
  maxRetries: number;
  agentTimeoutMs: number;
  managedRepoDir: string;
  managedRepoBranch: string;
  secretsPresent: { anthropicApiKey: boolean; openaiApiKey: boolean; geminiApiKey: boolean };
  appBaseUrl: string;
  apiBaseUrl: string;
}

export interface GitCommitRecord {
  id: string;
  commitSha: string;
  branch: string;
  message: string;
  author: string;
  prStatus: string;
  committedAt: string;
}

export type TestRunStatus = "running" | "passed" | "failed" | "error";
export type TestRunTrigger = "manual" | "auto_after_commit";

export interface TestRun {
  id: string;
  testFileId: string;
  triggeredBy: TestRunTrigger;
  status: TestRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totalTests: number | null;
  passedCount: number | null;
  failedCount: number | null;
  skippedCount: number | null;
  artifactsDir: string | null;
  errorMessage: string | null;
}

export interface TestRunCase {
  id: string;
  testRunId: string;
  suiteTitle: string | null;
  title: string;
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  durationMs: number;
  errorMessage: string | null;
  errorStack: string | null;
  screenshotPath: string | null;
  tracePath: string | null;
  stdout: string[];
  stderr: string[];
}

export interface DashboardSummary {
  totalRequirements: number;
  requirementsInProgress: number;
  requirementsFailed: number;
  scenariosGenerated: number;
  scenariosAwaitingApproval: number;
  testsGenerated: number;
  testsApproved: number;
  testsCommitted: number;
  commitsTotal: number;
  agentJobsRunning: number;
  agentJobsFailed: number;
  testRunsTotal: number;
  testRunsPassed: number;
  testRunsFailed: number;
  testRunsInProgress: number;
  pipeline: { key: string; label: string; count: number }[];
}
