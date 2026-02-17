import { unlinkSync } from "node:fs";
import { basename } from "node:path";
import type { Config, SessionInfo, WorktreeInfo } from "./types.js";
import * as tmux from "./tmux.js";
import { detectSessionState, stateFilePath } from "./state-detector.js";
import { openTerminalAttached } from "./terminal.js";

/** Derive key from path basename — must match the hook scripts' logic. */
function worktreeKey(wt: WorktreeInfo): string {
  return basename(wt.path).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sessionName(prefix: string, wt: WorktreeInfo): string {
  return `${prefix}${worktreeKey(wt)}`;
}

export class SessionManager {
  constructor(private config: Config) {}

  /** Get current state of all sessions (live tmux + config worktrees). */
  refresh(): SessionInfo[] {
    const tmuxSessions = tmux.listSessions(this.config.tmuxPrefix);
    const tmuxNames = new Set(tmuxSessions.map((s) => s.name));
    const sessions: SessionInfo[] = [];

    // For each tmux session matching our prefix, find the corresponding worktree
    for (const ts of tmuxSessions) {
      const suffix = ts.name.slice(this.config.tmuxPrefix.length);
      const wt = this.config.worktrees.find((w) => worktreeKey(w) === suffix);

      if (!wt) continue; // tmux session doesn't match any known worktree

      const { state, stateUpdatedAt } = detectSessionState(suffix);

      sessions.push({
        name: ts.name,
        worktree: wt,
        state,
        stateUpdatedAt,
        alive: true,
      });
    }

    // Clean up stale state files for worktrees whose tmux session is gone
    for (const wt of this.config.worktrees) {
      const name = sessionName(this.config.tmuxPrefix, wt);
      if (tmuxNames.has(name)) continue;

      const key = worktreeKey(wt);
      const { state } = detectSessionState(key);
      if (state === "ended") {
        try { unlinkSync(stateFilePath(key)); } catch { /* ignore */ }
      }
    }

    return sessions;
  }

  /** Create a new Claude session in the given worktree. */
  createSession(wt: WorktreeInfo): string {
    const name = sessionName(this.config.tmuxPrefix, wt);
    const dir = basename(wt.path);
    const title = wt.branch ? `${wt.branch} — ${dir}` : dir;
    tmux.createSession(name, wt.path, this.config.claudeBinary, title);
    return name;
  }

  /** Kill a session and clean up its state file. */
  destroySession(session: SessionInfo): void {
    tmux.killSession(session.name);
    const key = worktreeKey(session.worktree);
    try {
      unlinkSync(stateFilePath(key));
    } catch {
      // State file may not exist
    }
  }

  /** Attach to a session in a new Terminal.app window. */
  attachSession(session: SessionInfo): void {
    openTerminalAttached(session.name);
  }

  /** Get worktrees that don't have a running session. */
  availableWorktrees(currentSessions: SessionInfo[]): WorktreeInfo[] {
    const activePaths = new Set(
      currentSessions.filter((s) => s.alive).map((s) => s.worktree.path),
    );
    return this.config.worktrees.filter((wt) => !activePaths.has(wt.path));
  }
}
