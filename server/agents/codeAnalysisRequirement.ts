import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { requirements, scenarios, approvalAuditLog, type RequirementStatus } from "../db/schema.js";

export interface CodeAnalysisRequirementHandle {
  requirement: typeof requirements.$inferSelect;
  /** True when an existing requirement for this screen was reused rather than a new one created. */
  reused: boolean;
  /** Status to put back if this analysis fails - a failed re-analysis must not turn a working requirement into a failed one. */
  statusOnFailure: RequirementStatus;
}

/**
 * The one requirement for a screen/behaviour of an application. Re-analysis
 * (Re-analyze all, Analyze remaining modules, retrying a failed analysis)
 * updates that requirement in place instead of adding another one next to it -
 * which used to leave several requirements per screen, each tested separately.
 * A partial unique index on (application, source module) enforces this in the
 * database (migration 0010).
 */
export function beginCodeAnalysisRequirement(
  db: Db,
  input: { applicationId: string | undefined; sourceModule: string; title: string; rawText: string }
): CodeAnalysisRequirementHandle {
  const existing = db
    .select()
    .from(requirements)
    .where(
      and(
        eq(requirements.source, "code_analysis"),
        eq(requirements.isDeleted, false),
        eq(requirements.sourceModule, input.sourceModule),
        input.applicationId ? eq(requirements.applicationId, input.applicationId) : isNull(requirements.applicationId)
      )
    )
    .orderBy(desc(requirements.createdAt))
    .all()[0];

  if (existing) {
    const requirement = db
      .update(requirements)
      .set({ title: input.title, rawText: input.rawText, status: "analyzing", updatedAt: new Date() })
      .where(eq(requirements.id, existing.id))
      .returning()
      .get();
    return { requirement, reused: true, statusOnFailure: existing.currentAnalysisId ? existing.status : "failed" };
  }

  const requirement = db
    .insert(requirements)
    .values({
      title: input.title,
      rawText: input.rawText,
      submittedBy: "code-analysis-agent",
      source: "code_analysis",
      sourceModule: input.sourceModule,
      status: "analyzing",
      applicationId: input.applicationId,
    })
    .returning()
    .get();
  return { requirement, reused: false, statusOnFailure: "failed" };
}

/**
 * Once a re-analysis has produced new scenarios, the previous ones are
 * retired (soft-deleted, with an audit entry - never hard-deleted) so the
 * requirement doesn't list both generations side by side. Test files, test
 * runs and commits made from them are kept as history.
 */
export function retireScenarios(db: Db, requirementId: string, exceptAnalysisId: string): void {
  const old = db
    .select({ id: scenarios.id, status: scenarios.status, analysisId: scenarios.analysisId })
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.isDeleted, false)))
    .all()
    .filter((s) => s.analysisId !== exceptAnalysisId);
  for (const s of old) {
    db.update(scenarios).set({ isDeleted: true, updatedAt: new Date() }).where(eq(scenarios.id, s.id)).run();
    db.insert(approvalAuditLog)
      .values({
        entityType: "scenario",
        entityId: s.id,
        action: "deleted",
        actorType: "system_auto",
        actor: "code-analysis-agent",
        reason: "Superseded by a re-analysis of the same screen",
        previousStatus: s.status,
        newStatus: s.status,
      })
      .run();
  }
}
