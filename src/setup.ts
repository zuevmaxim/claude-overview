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
 * Claude Code pipes a JSON object to stdin with session_id, cwd, etc.
 * We read cwd from stdin and derive the worktree key from it.
 */
function makeHookScript(state: string, event: string): string {
  return `#!/bin/bash
# Claude Overview hook: ${event} -> ${state}
STATE_DIR="${STATE_DIR}"
mkdir -p "$STATE_DIR"

# Read hook input JSON from stdin
INPUT="$(cat)"

# Extract cwd and session_id from the JSON input
CWD="$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | head -1 | cut -d'"' -f4)"
SESSION_ID="$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)"

if [ -z "$CWD" ]; then
  CWD="$(pwd)"
fi

KEY="$(basename "$CWD" | tr -c 'a-zA-Z0-9_-' '_')"

cat > "$STATE_DIR/$KEY.json" <<EOJSON
{
  "state": "${state}",
  "timestamp": $(date +%s)000,
  "event": "${event}",
  "sessionId": "$SESSION_ID"
}
EOJSON
`;
}

interface CommandHook {
  type: "command";
  command: string;
}

interface HookEntry {
  matcher: string;
  hooks: CommandHook[];
}

type HooksMap = Record<string, HookEntry[]>;

export function runSetup(): void {
  console.log("Setting up Claude Overview hooks...\n");

  // 1. Create state directory
  mkdirSync(STATE_DIR, { recursive: true });
  console.log(`  Created state directory: ${STATE_DIR}`);

  // 2. Create hook scripts
  mkdirSync(HOOKS_DIR, { recursive: true });

  const hookDefs: Array<{ event: string; state: string; filename: string; matcher: string }> = [
    { event: "Stop", state: "waiting", filename: "on-stop.sh", matcher: "" },
    { event: "Notification", state: "waiting", filename: "on-notification.sh", matcher: "" },
    { event: "UserPromptSubmit", state: "running", filename: "on-prompt-submit.sh", matcher: "" },
    { event: "SessionStart", state: "waiting", filename: "on-session-start.sh", matcher: "" },
    { event: "SessionEnd", state: "ended", filename: "on-session-end.sh", matcher: "" },
  ];

  for (const h of hookDefs) {
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

  const existingHooks = (settings["hooks"] ?? {}) as HooksMap;

  for (const h of hookDefs) {
    const scriptPath = join(HOOKS_DIR, h.filename);
    const newHook: CommandHook = { type: "command", command: scriptPath };

    if (!existingHooks[h.event]) {
      // No entries for this event yet
      existingHooks[h.event] = [{ matcher: h.matcher, hooks: [newHook] }];
    } else {
      // Check if our script is already registered
      const alreadyRegistered = existingHooks[h.event].some((entry) =>
        entry.hooks.some((hook) => hook.type === "command" && hook.command === scriptPath),
      );
      if (!alreadyRegistered) {
        existingHooks[h.event].push({ matcher: h.matcher, hooks: [newHook] });
      }
    }
  }

  settings["hooks"] = existingHooks;
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  Updated ${SETTINGS_PATH}`);

  console.log("\nSetup complete! Hook events will write state to:");
  console.log(`  ${STATE_DIR}/<worktree-key>.json`);
  console.log("\nStart the dashboard with: claude-overview");
}
