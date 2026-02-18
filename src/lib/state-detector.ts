import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HookStateFile, SessionState } from "./types.js";
import { STATE_DIR } from "./paths.js";

/** Get the state file path for a worktree key. */
export function stateFilePath(worktreeKey: string): string {
  return join(STATE_DIR, `${worktreeKey}.json`);
}

/**
 * Detect the state of a session by reading its hook state file.
 */
export function detectSessionState(
  worktreeKey: string,
): { state: SessionState; stateUpdatedAt: number; sessionId?: string } {
  const path = stateFilePath(worktreeKey);
  if (!existsSync(path)) {
    return { state: "unknown", stateUpdatedAt: Date.now() };
  }
  try {
    const hookState = JSON.parse(readFileSync(path, "utf-8")) as HookStateFile;
    return {
      state: hookState.state,
      stateUpdatedAt: hookState.timestamp,
      sessionId: hookState.sessionId,
    };
  } catch {
    return { state: "unknown", stateUpdatedAt: Date.now() };
  }
}
