export type SessionState = "running" | "waiting" | "planned" | "ended" | "unknown";

export interface WorktreeInfo {
  path: string;
  label: string;
  branch?: string;
}

export interface SessionInfo {
  /** tmux session name (e.g. cov_wt-1) */
  name: string;
  /** The worktree this session is running in */
  worktree: WorktreeInfo;
  /** Current state of the Claude session */
  state: SessionState;
  /** When the state was last updated */
  stateUpdatedAt: number;
  /** Whether the tmux session is alive */
  alive: boolean;
  /** Path to a plan file when state is "planned" */
  planFile?: string;
}

export interface HookStateFile {
  state: SessionState;
  timestamp: number;
  event?: string;
  sessionId?: string;
}

export interface Config {
  worktrees: WorktreeInfo[];
  worktreeDiscovery: {
    enabled: boolean;
    repoPath?: string;
  };
  tmuxPrefix: string;
  pollIntervalMs: number;
  claudeBinary: string;
  ideBinary: string;
}
