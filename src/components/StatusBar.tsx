import React from "react";
import { Box, Text } from "ink";

interface Props {
  sessionCount: number;
  waitingCount: number;
  plannedCount: number;
}

export function StatusBar({ sessionCount, waitingCount, plannedCount }: Props) {
  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text>
        <Text bold>j/k</Text> navigate {"  "}
        <Text bold>Enter</Text> attach {"  "}
        <Text bold>n</Text> new {"  "}
        <Text bold>c</Text> commit {"  "}
        <Text bold>p</Text> open plan {"  "}
        <Text bold>i</Text> idea {"  "}
        <Text bold>d</Text> delete {"  "}
        <Text bold>r</Text> refresh {"  "}
        <Text bold>q</Text> quit
      </Text>
      <Text>
        {sessionCount > 0 && (
          <>
            <Text color="cyan">{sessionCount} sessions</Text>
            {waitingCount > 0 && (
              <Text color="yellow"> ({waitingCount} waiting)</Text>
            )}
            {plannedCount > 0 && (
              <Text color="magenta"> ({plannedCount} planned)</Text>
            )}
          </>
        )}
      </Text>
    </Box>
  );
}
