import React, { useState, useCallback } from "react";
import { spawn } from "node:child_process";
import { Box, Text, useInput, useApp } from "ink";
import { TextInput } from "@inkjs/ui";
import type { Config, SessionInfo, WorktreeInfo } from "./lib/types.js";
import { useSessions } from "./hooks/use-sessions.js";
import { SessionList } from "./components/SessionList.js";
import { WorktreeSelector } from "./components/WorktreeSelector.js";
import { BranchCheckPrompt } from "./components/BranchCheckPrompt.js";
import { NewWorktreePrompt } from "./components/NewWorktreePrompt.js";
import { StatusBar } from "./components/StatusBar.js";
import { getCurrentBranch, getDefaultBranch } from "./lib/git.js";

type View = "list" | "worktree-picker" | "commit-input" | "branch-check" | "new-worktree";

interface Props {
  config: Config;
}

export function App({ config }: Props) {
  const { exit } = useApp();
  const {
    sessions,
    loading,
    createSession,
    destroySession,
    attachSession,
    openPlanFile,
    availableWorktrees,
    hasUncommittedChanges,
    commitAll,
  } = useSessions(config);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<View>("list");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SessionInfo | null>(null);
  const [pendingDeleteDirty, setPendingDeleteDirty] = useState(false);
  const [commitTarget, setCommitTarget] = useState<SessionInfo | null>(null);
  const [pendingWorktree, setPendingWorktree] = useState<WorktreeInfo | null>(null);
  const [branchInfo, setBranchInfo] = useState<{ current: string; default: string } | null>(null);

  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

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
          const child = spawn(config.ideBinary, [session.worktree.path], {
            detached: true,
            stdio: "ignore",
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

  const handleCommitSubmit = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || !commitTarget) {
        showMessage("Commit cancelled");
        setCommitTarget(null);
        setView("list");
        return;
      }
      const result = commitAll(commitTarget.worktree, trimmed);
      if (result.success) {
        showMessage(`Committed in ${commitTarget.worktree.label}`);
      } else {
        showMessage(`Commit failed: ${result.error}`);
      }
      setCommitTarget(null);
      setView("list");
    },
    [commitTarget, commitAll, showMessage],
  );

  const handleWorktreeSelect = useCallback(
    (wt: WorktreeInfo) => {
      const current = getCurrentBranch(wt.path);
      const defaultBr = getDefaultBranch(wt.path);

      if (!current || !defaultBr || current === defaultBr) {
        const result = createSession(wt);
        setView("list");
        if (result.success) {
          showMessage(`Started session in ${wt.label}`);
        } else {
          showMessage(result.error ?? "Failed to create session");
        }
        return;
      }

      setPendingWorktree(wt);
      setBranchInfo({ current, default: defaultBr });
      setView("branch-check");
    },
    [createSession, showMessage],
  );

  const handleBranchCheckDone = useCallback(
    (updatedWorktree: WorktreeInfo) => {
      const result = createSession(updatedWorktree);
      setPendingWorktree(null);
      setBranchInfo(null);
      setView("list");
      if (result.success) {
        showMessage(`Started session in ${updatedWorktree.label}`);
      } else {
        showMessage(result.error ?? "Failed to create session");
      }
    },
    [createSession, showMessage],
  );

  const handleBranchCheckCancel = useCallback(() => {
    setPendingWorktree(null);
    setBranchInfo(null);
    setView("list");
  }, []);

  const handleCreateNewWorktree = useCallback(() => {
    setView("new-worktree");
  }, []);

  const handleNewWorktreeDone = useCallback(
    (newWt: WorktreeInfo) => {
      config.worktrees.push(newWt);
      const result = createSession(newWt);
      setView("list");
      if (result.success) {
        showMessage(`Created worktree and started session in ${newWt.label}`);
      } else {
        showMessage(result.error ?? "Worktree created but session failed");
      }
    },
    [config, createSession, showMessage],
  );

  const waitingCount = sessions.filter((s) => s.state === "waiting").length;
  const plannedCount = sessions.filter((s) => s.state === "planned").length;

  if (loading) {
    return (
      <Box paddingX={1}>
        <Text>Loading sessions...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box paddingX={1} marginBottom={1}>
        <Text bold color="blue">
          Claude Overview
        </Text>
        <Text dimColor> — Multi-session Dashboard</Text>
      </Box>

      {/* Delete confirmation */}
      {pendingDelete && (
        <Box paddingX={1} flexDirection="column">
          <Text color="yellow">Delete session {pendingDelete.worktree.label}? (y/n)</Text>
          {pendingDeleteDirty && (
            <Text color="red">  Worktree has uncommitted changes. Press n then c to commit first.</Text>
          )}
        </Box>
      )}

      {/* Message */}
      {message && !pendingDelete && (
        <Box paddingX={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      {/* Commit input */}
      {view === "commit-input" && commitTarget && (
        <Box paddingX={1} flexDirection="column">
          <Text color="cyan">Commit changes in {commitTarget.worktree.label}:</Text>
          <Box>
            <Text dimColor>{"› "}</Text>
            <TextInput
              placeholder="Enter commit message…"
              onSubmit={handleCommitSubmit}
            />
          </Box>
          <Text dimColor>Enter to commit · Escape to cancel</Text>
        </Box>
      )}

      {/* Main content */}
      {view === "list" || view === "commit-input" ? (
        <SessionList sessions={sessions} selectedIndex={selectedIndex} />
      ) : view === "worktree-picker" ? (
        <WorktreeSelector
          worktrees={availableWorktrees()}
          onSelect={handleWorktreeSelect}
          onCreateNew={handleCreateNewWorktree}
          onCancel={() => setView("list")}
        />
      ) : view === "new-worktree" ? (
        <NewWorktreePrompt
          config={config}
          onDone={handleNewWorktreeDone}
          onCancel={() => setView("list")}
        />
      ) : pendingWorktree && branchInfo ? (
        <BranchCheckPrompt
          worktree={pendingWorktree}
          currentBranch={branchInfo.current}
          defaultBranch={branchInfo.default}
          onDone={handleBranchCheckDone}
          onCancel={handleBranchCheckCancel}
        />
      ) : null}

      {/* Status bar */}
      <StatusBar sessionCount={sessions.length} waitingCount={waitingCount} plannedCount={plannedCount} />
    </Box>
  );
}
