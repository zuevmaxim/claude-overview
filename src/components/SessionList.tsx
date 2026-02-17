import React from "react";
import { Box, Text } from "ink";
import type { SessionInfo } from "../lib/types.js";
import { SessionRow } from "./SessionRow.js";

interface Props {
  sessions: SessionInfo[];
  selectedIndex: number;
}

export function SessionList({ sessions, selectedIndex }: Props) {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>No active sessions.</Text>
        <Text dimColor>
          Press <Text bold color="white">n</Text> to start a new session.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Sessions ({sessions.length})
        </Text>
      </Box>
      {sessions.map((session, i) => (
        <SessionRow
          key={session.name}
          session={session}
          selected={i === selectedIndex}
        />
      ))}
    </Box>
  );
}
