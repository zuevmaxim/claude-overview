# claude-overview

A TUI dashboard for managing multiple parallel Claude Code sessions across git worktrees. Each session runs in a tmux session, survives terminal closes, and the dashboard shows real-time status (running/waiting for input/ended).

## Prerequisites

- **Node.js** >= 18
- **tmux** — `brew install tmux`
- **Claude Code** CLI installed and available as `claude`
- **macOS** (uses Terminal.app via osascript for attach)

## Install

```bash
npm install
npm run build
```

## Run

Run from inside any git repository that has worktrees. Worktrees are auto-discovered via `git worktree list`:

```bash
cd /path/to/your/repo
node /path/to/claude-overview/dist/cli.js
```

Or after `npm link`:

```bash
cd /path/to/your/repo
claude-overview
```

No configuration file is needed — just run it from your repo directory.

## Configuration (optional)

A config file is only needed if you want to override defaults or add worktrees manually. Create `claude-overview.config.json` in the working directory or `~/.config/claude-overview/config.json`:

```json
{
  "worktrees": [
    { "path": "/absolute/path/to/extra-worktree", "label": "extra" }
  ],
  "tmuxPrefix": "cov_",
  "pollIntervalMs": 1500,
  "claudeBinary": "claude"
}
```

- **worktrees** — additional worktree paths beyond what git discovers automatically
- **tmuxPrefix** — prefix for tmux session names (default `cov_`)
- **pollIntervalMs** — how often to refresh session state (default 1500ms)
- **claudeBinary** — name or path of the Claude CLI binary (default `claude`)

You can also pass `--config /path/to/config.json` explicitly.

## Keybindings

| Key | Action |
|-----|--------|
| `j` / `k` or arrows | Navigate session list |
| `Enter` | Attach to session (opens a new Terminal.app window) |
| `n` | New session (pick from available worktrees) |
| `d` | Kill selected session |
| `r` | Force refresh |
| `q` | Quit dashboard |

## How it works

1. **New session** — press `n`, pick a worktree, and a tmux session is created running `claude` in that directory.
2. **Monitoring** — the dashboard polls hook state files to show whether each session is running, waiting for input, or ended.
3. **Attach** — press `Enter` to open a Terminal.app window attached to the tmux session. Closing the window detaches without killing Claude.
4. **Kill** — press `d` to kill the tmux session and clean up its state file.

## Hooks & file locations

On startup, claude-overview automatically installs [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) to track session state. No manual setup needed.

**Claude Code settings** — hooks are registered in:
- `~/.claude/settings.json`

The following hook events are registered:

| Hook Event | State written | Meaning |
|---|---|---|
| `SessionStart` | `waiting` | Claude started, showing initial prompt |
| `UserPromptSubmit` | `running` | User submitted a prompt, Claude is working |
| `Stop` | `waiting` | Claude finished responding, waiting for input |
| `Notification` | `waiting` | Claude needs permission approval |
| `SessionEnd` | `ended` | Session exited |

**Hook scripts** are stored in:
- `~/.local/share/claude-overview/hooks/`

**Session state files** are written by hooks to:
- `~/.local/state/claude-overview/sessions/<worktree-dir>.json`

Each state file contains the current state, timestamp, event name, and session ID. The dashboard reads these files on each poll cycle to update the display.
