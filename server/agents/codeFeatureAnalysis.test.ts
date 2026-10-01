import assert from "node:assert/strict";
import { test } from "node:test";
import { IntelligenceAnalysisSchema } from "../schemas/analysis.js";
import { normalizeScenarioLabels } from "./codeFeatureAnalysis.js";

const scenario = (overrides: Record<string, unknown>) => ({
  title: "t",
  description: "d",
  scenarioType: "positive",
  priority: "high",
  riskLevel: "medium",
  preconditions: [],
  draftSteps: ["step"],
  expectedResult: "r",
  aiConfidence: 0.8,
  ...overrides,
});

test("normalizeScenarioLabels maps the label variants models actually return onto the allowed values", () => {
  // The kind of output that failed the Navigation analysis: one scenario with
  // a near-miss scenarioType used to reject the whole response.
  const raw = {
    functionalRequirements: [{ description: "f" }],
    userRoles: ["Agent"],
    scenarios: [
      scenario({ scenarioType: "Edge Case", priority: "P0", riskLevel: "Critical" }),
      scenario({ scenarioType: "negative-test", priority: "Minor", riskLevel: "low" }),
      scenario({ scenarioType: "happy path", priority: "HIGH", riskLevel: "severe" }),
      scenario({ scenarioType: "navigation", priority: "normal", riskLevel: "unknown" }),
    ],
  };
  const parsed = IntelligenceAnalysisSchema.safeParse(normalizeScenarioLabels(raw));
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  assert.deepEqual(
    parsed.data.scenarios.map((s) => [s.scenarioType, s.priority, s.riskLevel]),
    [
      ["edge_case", "critical", "high"],
      ["negative", "low", "low"],
      ["positive", "high", "high"],
      ["positive", "medium", "medium"],
    ]
  );
});

test("normalizeScenarioLabels leaves output without a scenarios array untouched", () => {
  assert.deepEqual(normalizeScenarioLabels({ foo: 1 }), { foo: 1 });
  assert.equal(normalizeScenarioLabels(null), null);
});
