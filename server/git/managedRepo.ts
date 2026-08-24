import { simpleGit } from "simple-git";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { testFiles, gitCommits, gitCommitFiles, approvalAuditLog, requirements } from "../db/schema.js";

function repo(config: Config) {
  return simpleGit(config.managedRepoDir);
}

export interface RepoStatus {
  dir: string;
  branch: string;
  changedFiles: string[];
  isClean: boolean;
}

export async function getRepoStatus(config: Config): Promise<RepoStatus> {
  const status = await repo(config).status();
  return {
    dir: config.managedRepoDir,
    branch: status.current ?? config.managedRepoBranch,
    changedFiles: status.files.map((f) => f.path),
    isClean: status.isClean(),
  };
}

export interface CommitHistoryEntry {
  hash: string;
  date: string;
  message: string;
  author: string;
}

export async function getCommitHistory(config: Config, limit = 50): Promise<CommitHistoryEntry[]> {
  const log = await repo(config).log({ maxCount: limit });
  return log.all.map((c) => ({ hash: c.hash, date: c.date, message: c.message, author: c.author_name }));
}

/**
 * Writes each approved test file's code to disk in the managed repo,
 * `git add` + `git commit`, then records the commit (gate G4) - this is the
 * only place `test_files.status` moves to `committed`. Local-commit-only
 * per Phase 1 scope: `git_commits.prStatus` stays a fixed "not_created" stub.
 */
export async function commitApprovedTestFiles(
  db: Db,
  config: Config,
  testFileIds: string[],
  message: string,
  author: string
): Promise<{ commitSha: string; filesChanged: string[] }> {
  const files = testFileIds.map((id) => {
    const row = db.select().from(testFiles).where(eq(testFiles.id, id)).get();
    if (!row) throw new Error(`Test file ${id} not found`);
    if (row.status !== "approved") throw new Error(`Test file ${id} is not approved (status: ${row.status}) - approve it before committing.`);
    return row;
  });
  if (files.length === 0) throw new Error("No test file ids given to commit.");

  const git = repo(config);
  const relativePaths: string[] = [];
  for (const file of files) {
    const absPath = path.join(config.managedRepoDir, file.filePath);
    mkdirSync(path.dirname(absPath), { recursive: true });
    writeFileSync(absPath, file.code);
    relativePaths.push(file.filePath);
  }

  await git.add(relativePaths);
  const authorEmail = author.includes("@") ? author : `${author}@ai-testing-platform.local`;
  const commitResult = await git.commit(message, relativePaths, { "--author": `"${author} <${authorEmail}>"` });
  const commitSha = commitResult.commit;
  const branchSummary = await git.branch();

  const commitRow = db
    .insert(gitCommits)
    .values({ commitSha, branch: branchSummary.current ?? config.managedRepoBranch, message, author })
    .returning({ id: gitCommits.id })
    .get();

  for (const file of files) {
    db.insert(gitCommitFiles).values({ commitId: commitRow.id, testFileId: file.id, filePathAtCommit: file.filePath }).run();
    db.update(testFiles).set({ status: "committed" }).where(eq(testFiles.id, file.id)).run();
    db.insert(approvalAuditLog)
      .values({
        entityType: "git_commit",
        entityId: commitRow.id,
        action: "approved",
        actorType: "human",
        actor: author,
        previousStatus: "approved",
        newStatus: "committed",
      })
      .run();
  }

  const requirementIds = [...new Set(files.map((f) => f.requirementId))];
  for (const reqId of requirementIds) {
    db.update(requirements).set({ status: "committed", updatedAt: new Date() }).where(eq(requirements.id, reqId)).run();
  }

  return { commitSha, filesChanged: relativePaths };
}
