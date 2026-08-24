import type { ApprovalMode } from "../db/schema.js";

export type GateName = "G1_scenario_intent" | "G2_grounded_plan" | "G3_generated_code" | "G4_commit";

/**
 * Manual: every gate needs a human click.
 * Semi-Automatic: G1/G2 (AI judgment - scenario intent, whether grounding
 *   correctly read the app) stay human; G3/G4 auto-pass once the
 *   deterministic syntax/locator check is green.
 * Fully-Automatic: every gate auto-passes on success.
 * A failed agent run NEVER auto-advances in any mode - this function is
 * only ever consulted on a success path.
 */
export function shouldAutoApprove(mode: ApprovalMode, gate: GateName, deterministicCheckPassed: boolean): boolean {
  if (mode === "fully_automatic") return true;
  if (mode === "semi_automatic") {
    return (gate === "G3_generated_code" || gate === "G4_commit") && deterministicCheckPassed;
  }
  return false;
}
