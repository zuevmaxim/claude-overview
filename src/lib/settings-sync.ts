import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getWorktreeSettingsPath } from "./paths.js";

interface Settings {
  permissions?: {
    allow?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function readSettings(filePath: string): Settings {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

/** Sync permissions.allow between the given worktree paths. */
export function syncSettingsAllow(worktreePaths: string[]): void {
  const allEntries = new Set<string>();
  const data: Array<{
    settingsPath: string;
    settings: Settings;
    currentAllow: string[];
  }> = [];

  for (const wtPath of worktreePaths) {
    const settingsPath = getWorktreeSettingsPath(wtPath);
    const settings = readSettings(settingsPath);
    const allow = settings.permissions?.allow ?? [];
    for (const entry of allow) allEntries.add(entry);
    data.push({ settingsPath, settings, currentAllow: allow });
  }

  for (const d of data) {
    const currentSet = new Set(d.currentAllow);
    const newEntries = [...allEntries].filter((e) => !currentSet.has(e));
    if (newEntries.length === 0) continue;

    const result = [...d.currentAllow, ...newEntries];
    const settings = { ...d.settings };
    settings.permissions = { ...(settings.permissions ?? {}), allow: result };
    writeFileSync(d.settingsPath, JSON.stringify(settings, null, 2) + "\n");
  }
}
