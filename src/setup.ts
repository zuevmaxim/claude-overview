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

KEY="$(basename "$CWD" | tr -c 'a-zA-Z0-9_-' '_' | sed 's/_$//')"

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

const HOOK_DEFS: Array<{ event: string; state: string; filename: string; matcher: string }> = [
  { event: "Stop", state: "waiting", filename: "on-stop.sh", matcher: "" },
  { event: "Notification", state: "waiting", filename: "on-notification.sh", matcher: "" },
  { event: "UserPromptSubmit", state: "running", filename: "on-prompt-submit.sh", matcher: "" },
  { event: "SessionStart", state: "waiting", filename: "on-session-start.sh", matcher: "" },
  { event: "SessionEnd", state: "ended", filename: "on-session-end.sh", matcher: "" },
];

/**
 * Ensure hooks are set up. Silently creates/updates only what's missing.
 * Safe to call on every startup.
 */
export function ensureSetup(): void {
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(HOOKS_DIR, { recursive: true });

  // Write hook scripts (always overwrite to keep them up to date)
  for (const h of HOOK_DEFS) {
    writeFileSync(join(HOOKS_DIR, h.filename), makeHookScript(h.state, h.event), { mode: 0o755 });
  }

  // Read existing settings
  let settings: Record<string, unknown> = {};
  if (existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    } catch {
      // Corrupted file, start fresh
    }
  } else {
    mkdirSync(join(homedir(), ".claude"), { recursive: true });
  }

  const existingHooks = (settings["hooks"] ?? {}) as HooksMap;
  let changed = false;

  for (const h of HOOK_DEFS) {
    const scriptPath = join(HOOKS_DIR, h.filename);
    const newHook: CommandHook = { type: "command", command: scriptPath };

    if (!existingHooks[h.event]) {
      existingHooks[h.event] = [{ matcher: h.matcher, hooks: [newHook] }];
      changed = true;
    } else {
      const alreadyRegistered = existingHooks[h.event].some((entry) =>
        entry.hooks.some((hook) => hook.type === "command" && hook.command === scriptPath),
      );
      if (!alreadyRegistered) {
        existingHooks[h.event].push({ matcher: h.matcher, hooks: [newHook] });
        changed = true;
      }
    }
  }

  if (changed) {
    settings["hooks"] = existingHooks;
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  }
}
