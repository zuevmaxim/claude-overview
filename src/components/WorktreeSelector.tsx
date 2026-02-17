import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import type { WorktreeInfo } from "../lib/types.js";

interface Props {
  worktrees: WorktreeInfo[];
  onSelect: (wt: WorktreeInfo) => void;
  onCancel: () => void;
}

export function WorktreeSelector({ worktrees, onSelect, onCancel }: Props) {
  if (worktrees.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="yellow">
          No available worktrees. All worktrees already have active sessions.
        </Text>
        <Text dimColor>Press Escape or q to go back.</Text>
      </Box>
    );
  }

  const options = worktrees.map((wt) => ({
    label: `${wt.label}${wt.branch ? ` (${wt.branch})` : ""} — ${wt.path}`,
    value: wt.path,
  }));

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>Select a worktree to start a new Claude session:</Text>
      </Box>
      <Select
        options={options}
        onChange={(value) => {
          const wt = worktrees.find((w) => w.path === value);
          if (wt) onSelect(wt);
          else onCancel();
        }}
      />
      <Box marginTop={1}>
        <Text dimColor>Press Escape to cancel</Text>
      </Box>
    </Box>
  );
}
