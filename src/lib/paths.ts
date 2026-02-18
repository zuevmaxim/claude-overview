import { existsSync } from "node:fs";
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

export const CLAUDE_DIR = join(homedir(), ".claude");
export const CLAUDE_SETTINGS_PATH = join(CLAUDE_DIR, "settings.json");
export const CLAUDE_PROJECTS_DIR = join(CLAUDE_DIR, "projects");

/** Get the worktree-local settings path (prefers .local variant). */
export function getWorktreeSettingsPath(worktreePath: string): string {
  const localPath = join(worktreePath, ".claude", "settings.local.json");
  if (existsSync(localPath)) return localPath;
  return join(worktreePath, ".claude", "settings.json");
}

/** Derive key from path basename — must match the hook scripts' logic. */
export function worktreeKey(wt: WorktreeInfo): string {
  return basename(wt.path).replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_$/, "");
}
