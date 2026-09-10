import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { testFiles, approvalAuditLog } from "../db/schema.js";

function logAudit(
  db: Db,
  entityId: string,
  action: "approved" | "rejected" | "auto_approved",
  actorType: "human" | "system_auto",
  actor: string,
  previousStatus: string,
  newStatus: string,
  reason?: string
): void {
  db.insert(approvalAuditLog)
    .values({ entityType: "test_file", entityId, action, actorType, actor, reason, previousStatus, newStatus })
    .run();
}

function getTestFileOrThrow(db: Db, id: string) {
  const row = db.select().from(testFiles).where(eq(testFiles.id, id)).get();
  if (!row) throw new Error(`Test file ${id} not found`);
  return row;
}

/** Gate G3: only a syntax-valid file can be approved - never let a human accidentally approve code that failed the deterministic check. */
export function approveTestFile(db: Db, id: string, actor: string, actorType: "human" | "system_auto" = "human"): void {
  const file = getTestFileOrThrow(db, id);
  if (file.status !== "syntax_valid") {
    throw new Error(`Test file ${id} cannot be approved from status "${file.status}" - it must pass syntax/locator validation first.`);
  }
  db.update(testFiles).set({ status: "approved", approvedBy: actor, approvedAt: new Date() }).where(eq(testFiles.id, id)).run();
  logAudit(db, id, actorType === "human" ? "approved" : "auto_approved", actorType, actor, file.status, "approved");
}

export function rejectTestFile(db: Db, id: string, actor: string, reason: string): void {
  const file = getTestFileOrThrow(db, id);
  db.update(testFiles).set({ status: "rejected" }).where(eq(testFiles.id, id)).run();
  logAudit(db, id, "rejected", "human", actor, file.status, "rejected", reason);
}
