import { execFileSync } from "node:child_process";
import { execFileAsync } from "./async-exec.js";


export function getDefaultBranch(cwd: string): string | null {
  // Try symbolic-ref first (works when origin/HEAD is set)
  try {
    const ref = execFileSync(
      "git",
      ["symbolic-ref", "refs/remotes/origin/HEAD"],
      { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    // ref looks like "refs/remotes/origin/main"
    const branch = ref.replace("refs/remotes/origin/", "");
    if (branch) return branch;
  } catch {
    // Fallback: check if main or master exists
  }

  for (const candidate of ["main", "master"]) {
    try {
      execFileSync(
        "git",
        ["rev-parse", "--verify", `refs/heads/${candidate}`],
        { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
      return candidate;
    } catch {
      // Try next candidate
    }
  }

  return null;
}

export function getCurrentBranch(cwd: string): string | null {
  try {
    const branch = execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    // Detached HEAD returns "HEAD"
    if (!branch || branch === "HEAD") return null;
    return branch;
  } catch {
    return null;
  }
}

export async function checkoutNewBranch(
  cwd: string,
  branchName: string,
  baseBranch: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await execFileAsync("git", ["checkout", "-b", branchName, baseBranch], {
      cwd,
    });
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown git error";
    return { success: false, error: message };
  }
}

export async function resetBranchHardAsync(
  cwd: string,
  baseBranch: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await execFileAsync("git", ["reset", "--hard", baseBranch], {
      cwd,
    });
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown git error";
    return { success: false, error: message };
  }
}
