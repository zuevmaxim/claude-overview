import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HookStateFile, SessionState } from "./types.js";
import { capturePaneLines } from "./tmux.js";

const STATE_DIR = join(
  homedir(),
  ".local",
  "state",
  "claude-overview",
  "sessions",
);

/** Get the state file path for a worktree key. */
export function stateFilePath(worktreeKey: string): string {
  return join(STATE_DIR, `${worktreeKey}.json`);
}

/** Read the hook state file for a worktree. */
function readHookState(worktreeKey: string): HookStateFile | null {
  const path = stateFilePath(worktreeKey);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as HookStateFile;
  } catch {
    return null;
  }
}

/** Patterns that indicate Claude is waiting for input. */
const WAITING_PATTERNS = [
  /^>\s*$/, // empty prompt
  /Do you want to proceed/i,
  /\(y\/n\)/i,
  /Press Enter/i,
  /approve|reject|allow|deny/i,
  /Plan mode/i,
];

/** Detect state by analyzing tmux pane content. */
function detectFromPane(sessionName: string): SessionState {
  const lines = capturePaneLines(sessionName, 8);
  const relevantLines = lines.filter((l) => l.trim().length > 0);

  if (relevantLines.length === 0) return "unknown";

  // Check last few non-empty lines for waiting patterns
  const lastLines = relevantLines.slice(-5);
  for (const line of lastLines) {
    for (const pattern of WAITING_PATTERNS) {
      if (pattern.test(line)) return "waiting";
    }
  }

  return "running";
}

/**
 * Detect the state of a session.
 * Primary: hook state files. Fallback: tmux capture-pane.
 */
export function detectSessionState(
  worktreeKey: string,
  tmuxSessionName: string,
): { state: SessionState; stateUpdatedAt: number } {
  // Try hook state file first
  const hookState = readHookState(worktreeKey);
  if (hookState) {
    // If state file is fresh (less than 60s old), trust it
    const age = Date.now() - hookState.timestamp;
    if (age < 60_000) {
      return { state: hookState.state, stateUpdatedAt: hookState.timestamp };
    }
  }

  // Fallback: capture-pane analysis
  const state = detectFromPane(tmuxSessionName);
  return { state, stateUpdatedAt: Date.now() };
}
