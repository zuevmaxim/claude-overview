import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Config } from "./types.js";
import { execFileAsync } from "./async-exec.js";

/**
 * List all local branch names in the repo.
 */
export function listBranches(cwd: string): string[] {
  try {
    const output = execFileSync(
      "git",
      ["branch", "--list", "--format=%(refname:short)"],
      { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Parent directory for new worktrees (siblings of main repo).
 */
export function getWorktreeParentDir(config: Config): string {
  return dirname(config.worktrees[0]!.path);
}

/**
 * Suggest a directory name that doesn't clash with existing filesystem entries.
 * Pattern: <mainRepoBasename>-<N> starting at 2.
 */
export function suggestDirName(config: Config): string {
  const mainPath = config.worktrees[0]!.path;
  const base = basename(mainPath);
  const parentDir = dirname(mainPath);

  let n = 2;
  while (existsSync(join(parentDir, `${base}-${n}`))) {
    n++;
  }
  return `${base}-${n}`;
}

/**
 * Suggest a branch name that doesn't clash with existing branches.
 * Starts with dirName, appends -2, -3... if it already exists.
 */
export function suggestBranchName(cwd: string, dirName: string): string {
  const branches = new Set(listBranches(cwd));
  if (!branches.has(dirName)) return dirName;

  let n = 2;
  while (branches.has(`${dirName}-${n}`)) {
    n++;
  }
  return `${dirName}-${n}`;
}

/**
 * Create a new git worktree with a new branch based on baseBranch.
 */
export function createWorktree(
  mainRepoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch: string,
): { success: true } | { success: false; error: string } {
  try {
    execFileSync(
      "git",
      ["worktree", "add", "-b", branchName, worktreePath, baseBranch],
      {
        cwd: mainRepoPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown git error";
    return { success: false, error: message };
  }
}

export async function createWorktreeAsync(
  mainRepoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await execFileAsync(
      "git",
      ["worktree", "add", "-b", branchName, worktreePath, baseBranch],
      { cwd: mainRepoPath },
    );
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown git error";
    return { success: false, error: message };
  }
}
