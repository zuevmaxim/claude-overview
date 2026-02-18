import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import type { WorktreeInfo } from "../lib/types.js";

const CREATE_NEW_VALUE = "__create_new__";

interface Props {
  worktrees: WorktreeInfo[];
  onSelect: (wt: WorktreeInfo) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function WorktreeSelector({ worktrees, onSelect, onCreateNew, onCancel }: Props) {
  const options = [
    ...worktrees.map((wt) => ({
      label: `${wt.label}${wt.branch ? ` (${wt.branch})` : ""} — ${wt.path}`,
      value: wt.path,
    })),
    { label: "+ Create new worktree", value: CREATE_NEW_VALUE },
  ];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>Select a worktree or create a new one:</Text>
      </Box>
      <Select
        options={options}
        onChange={(value) => {
          if (value === CREATE_NEW_VALUE) {
            onCreateNew();
            return;
          }
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
