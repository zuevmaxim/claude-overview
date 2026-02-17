import React from "react";
import { Box, Text } from "ink";

interface Props {
  sessionCount: number;
  waitingCount: number;
}

export function StatusBar({ sessionCount, waitingCount }: Props) {
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
        <Text dimColor>j/k</Text> navigate {"  "}
        <Text dimColor>Enter</Text> attach {"  "}
        <Text dimColor>n</Text> new {"  "}
        <Text dimColor>c</Text> commit {"  "}
        <Text dimColor>d</Text> delete {"  "}
        <Text dimColor>r</Text> refresh {"  "}
        <Text dimColor>q</Text> quit
      </Text>
      <Text>
        {sessionCount > 0 && (
          <>
            <Text color="cyan">{sessionCount} sessions</Text>
            {waitingCount > 0 && (
              <Text color="yellow"> ({waitingCount} waiting)</Text>
            )}
          </>
        )}
      </Text>
    </Box>
  );
}
