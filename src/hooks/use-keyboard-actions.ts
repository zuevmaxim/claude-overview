import { spawn } from "node:child_process";
import { useInput } from "ink";
import type { SessionInfo, WorktreeInfo } from "../lib/types.js";

type View = "list" | "worktree-picker" | "commit-input" | "branch-check" | "new-worktree";

interface UseKeyboardActionsParams {
  view: View;
  setView: (v: View) => void;
  sessions: SessionInfo[];
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  pendingDelete: SessionInfo | null;
  setPendingDelete: (s: SessionInfo | null) => void;
  setPendingDeleteDirty: (v: boolean) => void;
  setCommitTarget: (s: SessionInfo | null) => void;
  setPendingWorktree: (wt: WorktreeInfo | null) => void;
  setBranchInfo: (info: { current: string; default: string } | null) => void;

  // Session actions
  destroySession: (session: SessionInfo) => void;
  attachSession: (session: SessionInfo) => void;
  openPlanFile: (session: SessionInfo) => boolean;
  hasUncommittedChanges: (wt: WorktreeInfo) => boolean;

  showMessage: (msg: string) => void;
  ideBinary: string;
  exit: () => void;
}

export function useKeyboardActions(params: UseKeyboardActionsParams): void {
  const {
    view,
    setView,
    sessions,
    selectedIndex,
    setSelectedIndex,
    pendingDelete,
    setPendingDelete,
    setPendingDeleteDirty,
    setCommitTarget,
    setPendingWorktree,
    setBranchInfo,
    destroySession,
    attachSession,
    openPlanFile,
    hasUncommittedChanges,
    showMessage,
    ideBinary,
    exit,
  } = params;

  useInput(
    (input, key) => {
      // Handle delete confirmation
      if (pendingDelete) {
        if (input === "y") {
          destroySession(pendingDelete);
          showMessage(`Destroyed session ${pendingDelete.worktree.label}`);
          setSelectedIndex((i) => Math.max(0, Math.min(i, sessions.length - 2)));
          setPendingDelete(null);
          setPendingDeleteDirty(false);
        } else if (input === "n" || key.escape) {
          setPendingDelete(null);
          setPendingDeleteDirty(false);
        }
        return;
      }

      if (view === "branch-check" || view === "new-worktree") {
        return;
      }
      if (view !== "list") {
        if (key.escape || input === "q") {
          setView("list");
        }
        return;
      }

      // Navigation
      if (input === "j" || key.downArrow) {
        setSelectedIndex((i) => Math.min(i + 1, sessions.length - 1));
      } else if (input === "k" || key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }

      // Actions
      else if (key.return) {
        const session = sessions[selectedIndex];
        if (session?.alive) {
          attachSession(session);
          showMessage(`Attached to ${session.worktree.label}`);
        }
      } else if (input === "n") {
        setView("worktree-picker");
      } else if (input === "c") {
        const session = sessions[selectedIndex];
        if (session) {
          if (!hasUncommittedChanges(session.worktree)) {
            showMessage("No uncommitted changes");
          } else {
            setCommitTarget(session);
            setView("commit-input");
          }
        }
      } else if (input === "p") {
        const session = sessions[selectedIndex];
        if (session?.state === "planned" && session.planFile) {
          if (openPlanFile(session)) {
            showMessage(`Opened plan for ${session.worktree.label}`);
          } else {
            showMessage("Failed to open plan file");
          }
        } else {
          showMessage("No plan available");
        }
      } else if (input === "i") {
        const session = sessions[selectedIndex];
        if (session) {
          const child = spawn(ideBinary, [session.worktree.path], {
            detached: true,
            stdio: "ignore",
            shell: true,
          });
          child.on("error", (err) => {
            showMessage(`Failed to open IDE: ${err.message}`);
          });
          child.unref();
          showMessage(`Opening ${session.worktree.label} in IDE`);
        }
      } else if (input === "d") {
        const session = sessions[selectedIndex];
        if (session) {
          setPendingDelete(session);
          setPendingDeleteDirty(hasUncommittedChanges(session.worktree));
        }
      } else if (input === "q") {
        exit();
      }
    },
    { isActive: view !== "commit-input" },
  );

  // Handle Escape during commit input
  useInput(
    (_input, key) => {
      if (key.escape) {
        setCommitTarget(null);
        setView("list");
      }
    },
    { isActive: view === "commit-input" },
  );
}
