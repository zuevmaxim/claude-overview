import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { WorktreeInfo } from "./types.js";

export const STATE_DIR = join(
  homedir(),
  ".local",
  "state",
  "claude-overview",
  "sessions",
);

export const HOOKS_DIR = join(homedir(), ".local", "share", "claude-overview", "hooks");

/** Derive key from path basename — must match the hook scripts' logic. */
export function worktreeKey(wt: WorktreeInfo): string {
  return basename(wt.path).replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_$/, "");
}
