import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

interface CacheEntry {
  planFile: string | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, CacheEntry>();

/** Strip ANSI escape sequences from a string. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Extract plan file paths from text. Exported for testing. */
export function extractPlanFiles(text: string): string[] {
  const cleaned = stripAnsi(text);
  const regex = /\/[^\s]*\/\.claude\/plans\/[^\s]*\.md/g;
  const matches = cleaned.match(regex) ?? [];
  // Deduplicate while preserving order (last occurrence wins for uniqueness)
  return [...new Set(matches)];
}

/**
 * Detect a plan file for a tmux session by scanning its scrollback.
 * Returns the path if found and the file exists on disk, null otherwise.
 * Results are cached for 10 seconds per session.
 */
export function detectPlanFile(sessionName: string): string | null {
  const now = Date.now();
  const cached = cache.get(sessionName);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.planFile;
  }

  let planFile: string | null = null;
  try {
    // Capture the last 500 lines of scrollback from the session's pane
    const scrollback = execFileSync(
      "tmux",
      ["capture-pane", "-t", sessionName, "-p", "-S", "-500"],
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "ignore"] },
    );
    const paths = extractPlanFiles(scrollback);
    // Use the last matching path (most recent plan)
    for (let i = paths.length - 1; i >= 0; i--) {
      if (existsSync(paths[i])) {
        planFile = paths[i];
        break;
      }
    }
  } catch {
    // tmux capture-pane may fail if session is dead
  }

  cache.set(sessionName, { planFile, cachedAt: now });
  return planFile;
}

/** Clear the cache entry for a session (call when state leaves "waiting"). */
export function clearPlanCache(sessionName: string): void {
  cache.delete(sessionName);
}
