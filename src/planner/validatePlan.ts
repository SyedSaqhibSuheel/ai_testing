import type { AppContext } from "../context/types.js";
import type { Scenario, TestPlan } from "../schemas/testPlan.js";

export interface PlanValidationIssue {
  scenarioId: string;
  stepIndex?: number;
  message: string;
}

/**
 * Static pre-flight check: does every step's targetTestId/targetRoute and
 * every expected backend call actually exist in the current scan? This
 * catches TEST_SCRIPT_ERROR before spending any browser/LLM budget on a
 * scenario that could never have passed, and cleanly separates "the plan
 * referenced something that never existed" from "it existed at scan time
 * but broke at runtime" (a real, distinct signal surfaced later by the
 * classifier).
 */
export function validatePlan(plan: TestPlan, context: AppContext): PlanValidationIssue[] {
  const knownTestIds = new Set(context.frontend.components.flatMap((c) => c.testIds));
  const knownRoutes = new Set(context.frontend.routes.map((r) => r.path));
  const knownEndpoints = new Set(
    context.backend.controllers.flatMap((c) => c.endpoints.map((e) => `${e.httpMethod} ${e.path}`))
  );

  const issues: PlanValidationIssue[] = [];

  const checkScenario = (scenario: Scenario) => {
    for (const step of scenario.steps) {
      if (step.targetTestId && !knownTestIds.has(step.targetTestId)) {
        issues.push({
          scenarioId: scenario.id,
          stepIndex: step.index,
          message: `Step references data-testid "${step.targetTestId}" which was not found anywhere in the current frontend scan.`,
        });
      }
      if (step.targetRoute && !knownRoutes.has(step.targetRoute)) {
        issues.push({
          scenarioId: scenario.id,
          stepIndex: step.index,
          message: `Step references route "${step.targetRoute}" which was not found in the current frontend route scan.`,
        });
      }
    }

    for (const call of scenario.expectedBackendCalls) {
      const key = `${call.method} ${call.path}`;
      if (!knownEndpoints.has(key) && !hasPathTemplateMatch(call.method, call.path, context)) {
        issues.push({
          scenarioId: scenario.id,
          message: `Expected backend call "${key}" does not match any endpoint found in the current backend scan.`,
        });
      }
    }
  };

  for (const scenario of plan.scenarios) checkScenario(scenario);
  return issues;
}

/** Allows a plan to use a concrete path (e.g. /admin/realms/x/users) against a templated scan path (e.g. /admin/realms/{realmName}/users). */
function hasPathTemplateMatch(method: string, planPath: string, context: AppContext): boolean {
  return context.backend.controllers.some((c) =>
    c.endpoints.some((e) => {
      if (e.httpMethod !== method) return false;
      const pattern = "^" + e.path.replace(/\{[^}]+\}/g, "[^/]+").replace(/\//g, "\\/") + "$";
      return new RegExp(pattern).test(planPath);
    })
  );
}
