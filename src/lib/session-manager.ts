import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { basename } from "node:path";
import type { Config, SessionInfo, WorktreeInfo } from "./types.js";
import { refreshWorktrees } from "./config.js";
import * as tmux from "./tmux.js";
import { detectSessionState, stateFilePath } from "./state-detector.js";
import { openTerminalAttached } from "./terminal.js";
import { worktreeKey } from "./paths.js";
import { getCurrentBranch } from "./git.js";
import { detectPlanFile, clearPlanCache } from "./plan-detector.js";
import { execFileAsync } from "./async-exec.js";
import { syncSettingsAllow } from "./settings-sync.js";

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
    const seenNames = new Set<string>();
    for (const ts of tmuxSessions) {
      if (seenNames.has(ts.name)) continue;
      const suffix = ts.name.slice(this.config.tmuxPrefix.length);
      const wt = this.config.worktrees.find((w) => worktreeKey(w) === suffix);

      if (!wt) continue; // tmux session doesn't match any known worktree

      let { state, stateUpdatedAt, sessionId } = detectSessionState(suffix);

      // Check for plan files in waiting sessions
      let planFile: string | undefined;
      if (state === "waiting" && sessionId) {
        const detected = detectPlanFile(wt.path, sessionId);
        if (detected) {
          state = "planned";
          planFile = detected;
        }
      } else if (sessionId) {
        clearPlanCache(sessionId);
      }

      // Re-read current branch so the display stays up-to-date after checkout
      const liveBranch = getCurrentBranch(wt.path);
      const worktree: WorktreeInfo = liveBranch
        ? { ...wt, branch: liveBranch }
        : wt;

      seenNames.add(ts.name);
      sessions.push({
        name: ts.name,
        worktree,
        state,
        stateUpdatedAt,
        alive: true,
        planFile,
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

  /** Create a new Claude session in the given worktree and attach to it. */
  createSession(wt: WorktreeInfo): string {
    const mainPath = this.config.worktrees[0]?.path;
    if (mainPath && mainPath !== wt.path) {
      syncSettingsAllow([mainPath, wt.path]);
    } else {
      syncSettingsAllow([wt.path]);
    }

    const name = sessionName(this.config.tmuxPrefix, wt);
    const dir = basename(wt.path);
    const title = wt.branch ? `${wt.branch} — ${dir}` : dir;
    tmux.createSession(name, wt.path, this.config.claudeBinary, title);
    openTerminalAttached(name);
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

  /** Open a plan file in the default app. Returns true on success. */
  openPlanFile(session: SessionInfo): boolean {
    if (!session.planFile) return false;
    try {
      execFileSync("open", [session.planFile], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /** Check if a worktree has uncommitted changes. */
  hasUncommittedChanges(wt: WorktreeInfo): boolean {
    try {
      const output = execFileSync("git", ["status", "--porcelain"], {
        cwd: wt.path,
        stdio: "pipe",
        encoding: "utf-8",
      });
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  /** Stage all changes and commit with the given message. */
  async commitAll(
    wt: WorktreeInfo,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await execFileAsync("git", ["add", "-A"], { cwd: wt.path });
      await execFileAsync("git", ["commit", "-m", message], { cwd: wt.path });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /** Get worktrees that don't have a running session. */
  availableWorktrees(currentSessions: SessionInfo[]): WorktreeInfo[] {
    refreshWorktrees(this.config);
    const activePaths = new Set(
      currentSessions.filter((s) => s.alive).map((s) => s.worktree.path),
    );
    return this.config.worktrees.filter((wt) => !activePaths.has(wt.path));
  }
}
