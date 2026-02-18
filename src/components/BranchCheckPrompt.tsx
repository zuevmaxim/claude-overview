import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner, TextInput } from "@inkjs/ui";
import type { WorktreeInfo } from "../lib/types.js";
import { checkoutNewBranch, resetBranchHardAsync } from "../lib/git.js";

type Phase = "confirm" | "input" | "loading" | "error" | "confirm-reset";

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
  const [isResetting, setIsResetting] = useState(false);

  const handleCheckout = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      setIsResetting(false);
      setPhase("loading");
      const result = await checkoutNewBranch(worktree.path, trimmed, defaultBranch);
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

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setPhase("loading");
    const result = await resetBranchHardAsync(worktree.path, defaultBranch);
    if (result.success) {
      onDone(worktree);
    } else {
      setErrorMessage(result.error);
      setPhase("error");
    }
  }, [worktree, defaultBranch, onDone]);

  useInput(
    (input, key) => {
      if (phase === "confirm") {
        if (key.escape) {
          onCancel();
        } else if (input === "n") {
          onDone(worktree);
        } else if (input === "y") {
          setPhase("input");
        } else if (input === "r") {
          setPhase("confirm-reset");
        }
      } else if (phase === "confirm-reset") {
        if (key.escape) {
          setPhase("confirm");
        } else if (input === "y") {
          void handleReset();
        } else if (input === "n") {
          setPhase("confirm");
        }
      } else if (phase === "error") {
        if (key.escape) {
          onCancel();
        } else if (input === "r") {
          if (isResetting) {
            setPhase("confirm");
          } else {
            setPhase("input");
          }
        }
      }
    },
    { isActive: phase !== "input" && phase !== "loading" },
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
          <Text><Text bold>[y]</Text> Create a new branch from {defaultBranch}</Text>
          <Text><Text bold>[n]</Text> Keep current branch</Text>
          <Text><Text bold>[r]</Text> Reset <Text color="yellow">{currentBranch}</Text> to <Text color="green">{defaultBranch}</Text></Text>
          <Box marginTop={1}>
            <Text dimColor>Press Escape to cancel</Text>
          </Box>
        </>
      )}

      {phase === "confirm-reset" && (
        <>
          <Box marginBottom={1}>
            <Text color="red">
              This will hard reset <Text bold>{currentBranch}</Text> to <Text bold>{defaultBranch}</Text>. All uncommitted changes will be lost.
            </Text>
          </Box>
          <Text>Are you sure? <Text bold>[y/n]</Text></Text>
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
          <Spinner label={isResetting ? "Resetting branch…" : "Checking out branch…"} />
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
