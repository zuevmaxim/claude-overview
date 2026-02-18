import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Config, WorktreeInfo } from "../lib/types.js";
import { getDefaultBranch } from "../lib/git.js";
import {
  suggestDirName,
  suggestBranchName,
  getWorktreeParentDir,
  createWorktree,
  listBranches,
} from "../lib/worktree.js";

type Phase = "dir-input" | "branch-input" | "error";

interface Props {
  config: Config;
  onDone: (newWorktree: WorktreeInfo) => void;
  onCancel: () => void;
}

export function NewWorktreePrompt({ config, onDone, onCancel }: Props) {
  const mainRepoPath = config.worktrees[0]?.path;
  const parentDir = useMemo(() => getWorktreeParentDir(config), [config]);
  const defaultBranch = useMemo(
    () => (mainRepoPath ? getDefaultBranch(mainRepoPath) : null) ?? "main",
    [mainRepoPath],
  );
  const defaultDirName = useMemo(() => suggestDirName(config), [config]);

  const [phase, setPhase] = useState<Phase>("dir-input");
  const [dirName, setDirName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [validationError, setValidationError] = useState("");

  const defaultBranchName = useMemo(
    () => dirName ? suggestBranchName(mainRepoPath!, dirName) : defaultDirName,
    [dirName, mainRepoPath, defaultDirName],
  );

  const handleDirSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      const fullPath = join(parentDir, trimmed);
      if (existsSync(fullPath)) {
        setValidationError(`Directory "${trimmed}" already exists.`);
        return;
      }
      setValidationError("");
      setDirName(trimmed);
      setPhase("branch-input");
    },
    [parentDir],
  );

  const handleBranchSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      const branches = new Set(listBranches(mainRepoPath!));
      if (branches.has(trimmed)) {
        setValidationError(`Branch "${trimmed}" already exists.`);
        return;
      }
      setValidationError("");

      const worktreePath = join(parentDir, dirName);
      const result = createWorktree(mainRepoPath!, worktreePath, trimmed, defaultBranch);

      if (result.success) {
        onDone({ path: worktreePath, label: dirName, branch: trimmed });
      } else {
        setErrorMessage(result.error);
        setPhase("error");
      }
    },
    [mainRepoPath, parentDir, dirName, defaultBranch, onDone],
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
      } else if (phase === "error" && input === "r") {
        setPhase("branch-input");
      }
    },
    { isActive: phase === "error" },
  );

  if (!mainRepoPath) {
    return (
      <Box paddingX={1}>
        <Text color="red">No repository found. Cannot create worktree.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {phase === "dir-input" && (
        <>
          <Box marginBottom={1}>
            <Text bold>Create new worktree</Text>
          </Box>
          <Text>
            Parent directory: <Text dimColor>{parentDir}/</Text>
          </Text>
          <Text>
            Base branch: <Text bold color="green">{defaultBranch}</Text>
          </Text>
          <Box marginTop={1}>
            <Text>Directory name:</Text>
          </Box>
          {validationError && <Text color="red">{validationError}</Text>}
          <Box>
            <Text dimColor>{"› "}</Text>
            <TextInput defaultValue={defaultDirName} onSubmit={handleDirSubmit} />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to confirm · Escape to cancel</Text>
          </Box>
        </>
      )}

      {phase === "branch-input" && (
        <>
          <Box marginBottom={1}>
            <Text bold>Create new worktree</Text>
          </Box>
          <Text>
            Directory: <Text color="cyan">{parentDir}/{dirName}</Text>
          </Text>
          <Box marginTop={1}>
            <Text>Branch name:</Text>
          </Box>
          {validationError && <Text color="red">{validationError}</Text>}
          <Box>
            <Text dimColor>{"› "}</Text>
            <TextInput defaultValue={defaultBranchName} onSubmit={handleBranchSubmit} />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to confirm · Escape to cancel</Text>
          </Box>
        </>
      )}

      {phase === "error" && (
        <>
          <Box marginBottom={1}>
            <Text color="red">Error creating worktree: {errorMessage}</Text>
          </Box>
          <Text>
            Press <Text bold>r</Text> to retry or <Text bold>Escape</Text> to cancel
          </Text>
        </>
      )}
    </Box>
  );
}
