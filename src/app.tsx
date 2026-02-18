import React, { useState, useCallback } from "react";
import { Box, Text, useApp } from "ink";
import { Spinner, TextInput } from "@inkjs/ui";
import type { Config, SessionInfo, WorktreeInfo } from "./lib/types.js";
import { useSessions } from "./hooks/use-sessions.js";
import { useKeyboardActions } from "./hooks/use-keyboard-actions.js";
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
    addWorktree,
  } = useSessions(config);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<View>("list");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SessionInfo | null>(null);
  const [pendingDeleteDirty, setPendingDeleteDirty] = useState(false);
  const [commitTarget, setCommitTarget] = useState<SessionInfo | null>(null);
  const [committing, setCommitting] = useState(false);
  const [pendingWorktree, setPendingWorktree] = useState<WorktreeInfo | null>(null);
  const [branchInfo, setBranchInfo] = useState<{ current: string; default: string } | null>(null);

  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  useKeyboardActions({
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
    ideBinary: config.ideBinary,
    exit,
  });

  const handleCommitSubmit = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || !commitTarget) {
        showMessage("Commit cancelled");
        setCommitTarget(null);
        setView("list");
        return;
      }
      setCommitting(true);
      const result = await commitAll(commitTarget.worktree, trimmed);
      setCommitting(false);
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
      addWorktree(newWt);
      const result = createSession(newWt);
      setView("list");
      if (result.success) {
        showMessage(`Created worktree and started session in ${newWt.label}`);
      } else {
        showMessage(result.error ?? "Worktree created but session failed");
      }
    },
    [addWorktree, createSession, showMessage],
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
          {committing ? (
            <Spinner label="Committing…" />
          ) : (
            <>
              <Text color="cyan">Commit changes in {commitTarget.worktree.label}:</Text>
              <Box>
                <Text dimColor>{"› "}</Text>
                <TextInput
                  placeholder="Enter commit message…"
                  onSubmit={handleCommitSubmit}
                />
              </Box>
              <Text dimColor>Enter to commit · Escape to cancel</Text>
            </>
          )}
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
