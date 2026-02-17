import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STATE_DIR = join(
  homedir(),
  ".local",
  "state",
  "claude-overview",
  "sessions",
);

const HOOKS_DIR = join(homedir(), ".local", "share", "claude-overview", "hooks");

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

/**
 * Hook script template.
 * Receives session info via env vars and writes state to a JSON file.
 * The worktree key is derived from the CWD.
 */
function makeHookScript(state: string, event: string): string {
  return `#!/bin/bash
# Claude Overview hook: ${event} -> ${state}
STATE_DIR="${STATE_DIR}"
mkdir -p "$STATE_DIR"

# Derive worktree key from CWD
CWD="$(pwd)"
KEY="$(basename "$CWD" | tr -c 'a-zA-Z0-9_-' '_')"

cat > "$STATE_DIR/$KEY.json" <<EOJSON
{
  "state": "${state}",
  "timestamp": $(date +%s)000,
  "event": "${event}",
  "sessionId": "\${SESSION_ID:-unknown}"
}
EOJSON
`;
}

interface HookEntry {
  matcher: string;
  hooks: Array<{
    type: "command";
    command: string;
  }>;
}

export function runSetup(): void {
  console.log("Setting up Claude Overview hooks...\n");

  // 1. Create state directory
  mkdirSync(STATE_DIR, { recursive: true });
  console.log(`  Created state directory: ${STATE_DIR}`);

  // 2. Create hook scripts
  mkdirSync(HOOKS_DIR, { recursive: true });

  const hooks: Array<{ event: string; state: string; filename: string }> = [
    { event: "Stop", state: "waiting", filename: "on-stop.sh" },
    { event: "Notification", state: "waiting", filename: "on-notification.sh" },
    { event: "UserPromptSubmit", state: "running", filename: "on-prompt-submit.sh" },
    { event: "SessionStart", state: "running", filename: "on-session-start.sh" },
    { event: "SessionEnd", state: "ended", filename: "on-session-end.sh" },
  ];

  for (const h of hooks) {
    const scriptPath = join(HOOKS_DIR, h.filename);
    writeFileSync(scriptPath, makeHookScript(h.state, h.event), { mode: 0o755 });
    console.log(`  Created hook script: ${scriptPath}`);
  }

  // 3. Update ~/.claude/settings.json
  let settings: Record<string, unknown> = {};
  if (existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    } catch {
      console.warn(`  Warning: Could not parse ${SETTINGS_PATH}, creating new`);
    }
  } else {
    const claudeDir = join(homedir(), ".claude");
    mkdirSync(claudeDir, { recursive: true });
  }

  // Build hook entries
  const hookEntries: HookEntry[] = hooks.map((h) => ({
    matcher: h.event,
    hooks: [
      {
        type: "command" as const,
        command: join(HOOKS_DIR, h.filename),
      },
    ],
  }));

  // Merge with existing hooks
  const existingHooks = (settings["hooks"] as HookEntry[] | undefined) ?? [];
  const existingMatchers = new Set(existingHooks.map((h) => h.matcher));

  for (const entry of hookEntries) {
    if (existingMatchers.has(entry.matcher)) {
      // Update existing entry
      const idx = existingHooks.findIndex((h) => h.matcher === entry.matcher);
      const existing = existingHooks[idx];
      // Check if our hook command already exists
      const ourCommand = entry.hooks[0].command;
      const alreadyHas = existing.hooks.some(
        (h) => h.type === "command" && h.command === ourCommand,
      );
      if (!alreadyHas) {
        existing.hooks.push(...entry.hooks);
      }
    } else {
      existingHooks.push(entry);
    }
  }

  settings["hooks"] = existingHooks;
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  Updated ${SETTINGS_PATH}`);

  console.log("\nSetup complete! Hook events will write state to:");
  console.log(`  ${STATE_DIR}/<worktree-key>.json`);
  console.log("\nStart the dashboard with: claude-overview");
}
