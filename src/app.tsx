import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { Config, SessionInfo, WorktreeInfo } from "./lib/types.js";
import { useSessions } from "./hooks/use-sessions.js";
import { SessionList } from "./components/SessionList.js";
import { WorktreeSelector } from "./components/WorktreeSelector.js";
import { StatusBar } from "./components/StatusBar.js";

type View = "list" | "worktree-picker";

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
    refresh,
  } = useSessions(config);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<View>("list");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SessionInfo | null>(null);

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
        } else if (input === "n" || key.escape) {
          setPendingDelete(null);
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
      } else if (input === "d") {
        const session = sessions[selectedIndex];
        if (session) {
          setPendingDelete(session);
        }
      } else if (input === "r") {
        refresh();
        showMessage("Refreshed");
      } else if (input === "q") {
        exit();
      }
    },
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
        <Box paddingX={1}>
          <Text color="yellow">Delete session {pendingDelete.worktree.label}? (y/n)</Text>
        </Box>
      )}

      {/* Message */}
      {message && !pendingDelete && (
        <Box paddingX={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      {/* Main content */}
      {view === "list" ? (
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
