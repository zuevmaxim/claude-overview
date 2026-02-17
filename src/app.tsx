import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { TextInput } from "@inkjs/ui";
import type { Config, SessionInfo, WorktreeInfo } from "./lib/types.js";
import { useSessions } from "./hooks/use-sessions.js";
import { SessionList } from "./components/SessionList.js";
import { WorktreeSelector } from "./components/WorktreeSelector.js";
import { StatusBar } from "./components/StatusBar.js";

type View = "list" | "worktree-picker" | "commit-input";

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
    availableWorktrees,
    hasUncommittedChanges,
    commitAll,
    refresh,
  } = useSessions(config);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<View>("list");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SessionInfo | null>(null);
  const [pendingDeleteDirty, setPendingDeleteDirty] = useState(false);
  const [commitTarget, setCommitTarget] = useState<SessionInfo | null>(null);

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
      } else if (input === "d") {
        const session = sessions[selectedIndex];
        if (session) {
          setPendingDelete(session);
          setPendingDeleteDirty(hasUncommittedChanges(session.worktree));
        }
      } else if (input === "r") {
        refresh();
        showMessage("Refreshed");
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
      createSession(wt);
      setView("list");
      showMessage(`Started session in ${wt.label}`);
    },
    [createSession, showMessage],
  );

  const waitingCount = sessions.filter((s) => s.state === "waiting").length;

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
      ) : (
        <WorktreeSelector
          worktrees={availableWorktrees()}
          onSelect={handleWorktreeSelect}
          onCancel={() => setView("list")}
        />
      )}

      {/* Status bar */}
      <StatusBar sessionCount={sessions.length} waitingCount={waitingCount} />
    </Box>
  );
}
