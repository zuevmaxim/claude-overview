import { useState, useEffect, useCallback, useRef } from "react";
import type { Config, SessionInfo, WorktreeInfo } from "../lib/types.js";
import { SessionManager } from "../lib/session-manager.js";

export interface UseSessionsResult {
  sessions: SessionInfo[];
  loading: boolean;
  createSession: (wt: WorktreeInfo) => void;
  destroySession: (session: SessionInfo) => void;
  attachSession: (session: SessionInfo) => void;
  openPlanFile: (session: SessionInfo) => boolean;
  availableWorktrees: () => WorktreeInfo[];
  hasUncommittedChanges: (wt: WorktreeInfo) => boolean;
  commitAll: (
    wt: WorktreeInfo,
    message: string,
  ) => { success: boolean; error?: string };
  refresh: () => void;
}

export function useSessions(config: Config): UseSessionsResult {
  const managerRef = useRef(new SessionManager(config));
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const doRefresh = useCallback(() => {
    const result = managerRef.current.refresh();
    setSessions(result);
    setLoading(false);
  }, []);

  // Poll on interval
  useEffect(() => {
    doRefresh();
    const interval = setInterval(doRefresh, config.pollIntervalMs);
    return () => clearInterval(interval);
  }, [config.pollIntervalMs, doRefresh]);

  const createSession = useCallback(
    (wt: WorktreeInfo) => {
      managerRef.current.createSession(wt);
      // Immediate refresh to pick up the new session
      setTimeout(doRefresh, 500);
    },
    [doRefresh],
  );

  const destroySession = useCallback(
    (session: SessionInfo) => {
      managerRef.current.destroySession(session);
      setTimeout(doRefresh, 300);
    },
    [doRefresh],
  );

  const attachSession = useCallback((session: SessionInfo) => {
    managerRef.current.attachSession(session);
  }, []);

  const openPlanFile = useCallback((session: SessionInfo) => {
    return managerRef.current.openPlanFile(session);
  }, []);

  const availableWorktrees = useCallback(() => {
    return managerRef.current.availableWorktrees(sessions);
  }, [sessions]);

  const hasUncommittedChanges = useCallback((wt: WorktreeInfo) => {
    return managerRef.current.hasUncommittedChanges(wt);
  }, []);

  const commitAll = useCallback(
    (wt: WorktreeInfo, message: string) => {
      return managerRef.current.commitAll(wt, message);
    },
    [],
  );

  return {
    sessions,
    loading,
    createSession,
    destroySession,
    attachSession,
    openPlanFile,
    availableWorktrees,
    hasUncommittedChanges,
    commitAll,
    refresh: doRefresh,
  };
}
