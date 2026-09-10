import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { scenarios, approvalAuditLog, type ScenarioStatus } from "../db/schema.js";

function logAudit(
  db: Db,
  entityId: string,
  action: "approved" | "rejected" | "regenerate_requested" | "edited" | "deleted" | "auto_approved",
  actorType: "human" | "system_auto",
  actor: string,
  previousStatus: string,
  newStatus: string,
  reason?: string
): void {
  db.insert(approvalAuditLog)
    .values({ entityType: "scenario", entityId, action, actorType, actor, reason, previousStatus, newStatus })
    .run();
}

function getScenarioOrThrow(db: Db, id: string) {
  const row = db.select().from(scenarios).where(eq(scenarios.id, id)).get();
  if (!row) throw new Error(`Scenario ${id} not found`);
  return row;
}

/**
 * Approve is status-aware: `ai_proposed` -> `approved` is gate G1 (scenario
 * intent, before the Planner runs); `grounded_pending_review` ->
 * `approved_for_generation` is gate G2 ("send to test generation").
 */
export function approveScenario(db: Db, id: string, actor: string, actorType: "human" | "system_auto" = "human"): void {
  const scenario = getScenarioOrThrow(db, id);
  const transitions: Partial<Record<ScenarioStatus, ScenarioStatus>> = {
    ai_proposed: "approved",
    grounded_pending_review: "approved_for_generation",
  };
  const nextStatus = transitions[scenario.status];
  if (!nextStatus) {
    throw new Error(`Scenario ${id} cannot be approved from status "${scenario.status}"`);
  }
  db.update(scenarios)
    .set({ status: nextStatus, approvedBy: actor, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(scenarios.id, id))
    .run();
  logAudit(db, id, actorType === "human" ? "approved" : "auto_approved", actorType, actor, scenario.status, nextStatus);
}

export function rejectScenario(db: Db, id: string, actor: string, reason: string): void {
  const scenario = getScenarioOrThrow(db, id);
  db.update(scenarios)
    .set({ status: "rejected", rejectedReason: reason, updatedAt: new Date() })
    .where(eq(scenarios.id, id))
    .run();
  logAudit(db, id, "rejected", "human", actor, scenario.status, "rejected", reason);
}

export function deleteScenario(db: Db, id: string, actor: string): void {
  const scenario = getScenarioOrThrow(db, id);
  db.update(scenarios).set({ isDeleted: true, updatedAt: new Date() }).where(eq(scenarios.id, id)).run();
  logAudit(db, id, "deleted", "human", actor, scenario.status, scenario.status);
}

export interface ScenarioEditPatch {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  riskLevel?: "low" | "medium" | "high";
  preconditions?: string[];
  draftSteps?: string[];
  expectedResult?: string;
}

export function editScenario(db: Db, id: string, patch: ScenarioEditPatch, actor: string): void {
  const scenario = getScenarioOrThrow(db, id);
  db.update(scenarios).set({ ...patch, updatedAt: new Date() }).where(eq(scenarios.id, id)).run();
  logAudit(db, id, "edited", "human", actor, scenario.status, scenario.status);
}
