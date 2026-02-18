import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner, TextInput } from "@inkjs/ui";
import type { WorktreeInfo } from "../lib/types.js";
import { checkoutNewBranchAsync } from "../lib/git.js";

type Phase = "confirm" | "input" | "loading" | "error";

interface Props {
  worktree: WorktreeInfo;
  currentBranch: string;
  defaultBranch: string;
  onDone: (updatedWorktree: WorktreeInfo) => void;
  onCancel: () => void;
}

export function BranchCheckPrompt({
  worktree,
  currentBranch,
  defaultBranch,
  onDone,
  onCancel,
}: Props) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [errorMessage, setErrorMessage] = useState("");
  const [branchName, setBranchName] = useState("");

  const handleCheckout = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      setPhase("loading");
      const result = await checkoutNewBranchAsync(worktree.path, trimmed, defaultBranch);
      if (result.success) {
        onDone({ ...worktree, branch: trimmed, label: trimmed });
      } else {
        setErrorMessage(result.error);
        setBranchName(trimmed);
        setPhase("error");
      }
    },
    [worktree, defaultBranch, onDone],
  );

  useInput(
    (input, key) => {
      if (phase === "confirm") {
        if (key.escape) {
          onCancel();
        } else if (input === "n") {
          onDone(worktree);
        } else if (input === "y") {
          setPhase("input");
        }
      } else if (phase === "error") {
        if (key.escape) {
          onCancel();
        } else if (input === "r") {
          setPhase("input");
        }
      }
    },
    { isActive: phase !== "input" },
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      {phase === "confirm" && (
        <>
          <Box marginBottom={1}>
            <Text>
              Current branch is <Text bold color="yellow">{currentBranch}</Text>
              {" "}(default is <Text bold color="green">{defaultBranch}</Text>).
            </Text>
          </Box>
          <Text>Create a new branch from {defaultBranch}? <Text bold>[y/n]</Text></Text>
          <Box marginTop={1}>
            <Text dimColor>Press Escape to cancel</Text>
          </Box>
        </>
      )}

      {phase === "input" && (
        <>
          <Box marginBottom={1}>
            <Text>Enter new branch name (base: <Text bold color="green">{defaultBranch}</Text>):</Text>
          </Box>
          <TextInput
            placeholder="feature/my-branch"
            onSubmit={handleCheckout}
          />
          <Box marginTop={1}>
            <Text dimColor>Press Enter to confirm, Escape to cancel</Text>
          </Box>
        </>
      )}

      {phase === "loading" && (
        <Box>
          <Spinner label="Checking out branch…" />
        </Box>
      )}

      {phase === "error" && (
        <>
          <Box marginBottom={1}>
            <Text color="red">Git error: {errorMessage}</Text>
          </Box>
          <Text>
            Press <Text bold>r</Text> to retry or <Text bold>Escape</Text> to cancel
          </Text>
        </>
      )}
    </Box>
  );
}
