import React from "react";
import { Box, Text } from "ink";
import type { SessionInfo, SessionState } from "../lib/types.js";

const STATE_ICONS: Record<SessionState, { icon: string; color: string }> = {
  running: { icon: "⚙", color: "cyan" },
  waiting: { icon: "●", color: "yellow" },
  planned: { icon: "◆", color: "magenta" },
  ended: { icon: "✕", color: "gray" },
  unknown: { icon: "?", color: "gray" },
};

interface Props {
  session: SessionInfo;
  selected: boolean;
}

export function SessionRow({ session, selected }: Props) {
  const { icon, color } = STATE_ICONS[session.state];
  const label = session.worktree.label;
  const branch = session.worktree.branch;
  const stateLabel = session.state.toUpperCase();

  return (
    <Box>
      <Text color={selected ? "blue" : undefined} bold={selected}>
        {selected ? "❯ " : "  "}
      </Text>
      <Text color={color}>{icon} </Text>
      <Text bold>{label.padEnd(20)}</Text>
      {branch && (
        <Text color="green">
          {` ${branch}`.padEnd(25)}
        </Text>
      )}
      <Text color={color}> [{stateLabel}]</Text>
    </Box>
  );
}
