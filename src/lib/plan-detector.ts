import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface CacheEntry {
  planFile: string | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 5_000;
const cache = new Map<string, CacheEntry>();

/**
 * Detect a plan file for a session by scanning its JSONL session log.
 * Looks for Write tool-use entries where the file_path contains `/.claude/plans/` and ends with `.md`.
 * Returns the last matching path that exists on disk, or null.
 */
export function detectPlanFile(
  worktreePath: string,
  sessionId: string,
): string | null {
  const now = Date.now();
  const cached = cache.get(sessionId);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.planFile;
  }

  let planFile: string | null = null;
  try {
    // Project key: worktree path with / replaced by -
    const projectKey = worktreePath.replace(/\//g, "-");
    const jsonlPath = join(
      homedir(),
      ".claude",
      "projects",
      projectKey,
      `${sessionId}.jsonl`,
    );

    if (!existsSync(jsonlPath)) {
      cache.set(sessionId, { planFile: null, cachedAt: now });
      return null;
    }

    const content = readFileSync(jsonlPath, "utf-8");
    const lines = content.split("\n");

    // Scan all lines for Write tool-use entries with plan file paths
    const planPaths: string[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        // Look for tool_use entries with type "Write" or tool name "Write"
        if (
          entry.type === "tool_use" &&
          entry.name === "Write" &&
          typeof entry.input?.file_path === "string"
        ) {
          const fp: string = entry.input.file_path;
          if (fp.includes("/.claude/plans/") && fp.endsWith(".md")) {
            planPaths.push(fp);
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Use the last matching path that exists on disk
    for (let i = planPaths.length - 1; i >= 0; i--) {
      if (existsSync(planPaths[i])) {
        planFile = planPaths[i];
        break;
      }
    }
  } catch {
    // File read errors
  }

  cache.set(sessionId, { planFile, cachedAt: now });
  return planFile;
}

/** Clear the cache entry for a session. */
export function clearPlanCache(sessionId: string): void {
  cache.delete(sessionId);
}
