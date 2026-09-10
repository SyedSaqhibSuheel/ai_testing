import { simpleGit } from "simple-git";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
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
 *
 * Handles "nothing to commit" gracefully by ensuring files are written before commit.
 */
export async function commitApprovedTestFiles(
  db: Db,
  config: Config,
  testFileIds: string[],
  message: string,
  author: string
): Promise<{ commitSha: string; filesChanged: string[]; status?: string }> {
  const files = testFileIds.map((id) => {
    const row = db.select().from(testFiles).where(eq(testFiles.id, id)).get();
    if (!row) throw new Error(`Test file ${id} not found`);
    if (row.status === "committed") throw new Error(`Test file ${id} is already committed. Regenerate it to create a new version for committing.`);
    if (row.status !== "approved") throw new Error(`Test file ${id} is not approved (status: ${row.status}) - approve it before committing.`);
    return row;
  });
  if (files.length === 0) throw new Error("No test file ids given to commit.");

  const git = repo(config);
  const relativePaths: string[] = [];

  // Step 1: Write all files to disk (synchronously to ensure they exist before git operations)
  for (const file of files) {
    const absPath = path.join(config.managedRepoDir, file.filePath);
    mkdirSync(path.dirname(absPath), { recursive: true });
    writeFileSync(absPath, file.code, "utf-8");

    // Verify file was actually written
    if (!existsSync(absPath)) {
      throw new Error(`Failed to write file to disk: ${absPath}`);
    }
    relativePaths.push(file.filePath);
  }

  // Step 2: Stage all changes (ensure all files are staged)
  // Use both add for specific files AND add -A to catch any untracked files
  if (relativePaths.length > 0) {
    // First add the specific files we just wrote
    await git.add(relativePaths);

    // Then do a general add -A to catch everything
    await git.add(['-A']);
  }

  // Step 3: Check git status before committing
  const status = await git.status();
  if (status.isClean()) {
    // Working tree is clean - files are already committed
    // Return success instead of error, but mark as "already committed"
    console.log("Git working tree is clean - no new changes to commit");

    // Since files are already committed, just update their status in DB
    for (const file of files) {
      const currentStatus = db.select().from(testFiles).where(eq(testFiles.id, file.id)).get()?.status;
      if (currentStatus !== "committed") {
        db.update(testFiles).set({ status: "committed" }).where(eq(testFiles.id, file.id)).run();
      }
    }

    // Get the latest commit SHA
    const log = await git.log({ maxCount: 1 });
    const latestCommitSha = log.latest?.hash || "HEAD";

    return {
      commitSha: latestCommitSha,
      filesChanged: relativePaths,
      status: "already_committed",
    };
  }

  // Step 4: Commit (only if there are actual changes)
  const authorEmail = author.includes("@") ? author : `${author}@ai-testing-platform.local`;
  const commitResult = await git.commit(message, relativePaths, {
    "--author": `"${author} <${authorEmail}>"`,
  });
  const commitSha = commitResult.commit;
  const branchSummary = await git.branch();

  // Step 5: Record commit in database
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
