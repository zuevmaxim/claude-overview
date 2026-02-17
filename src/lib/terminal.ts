import { execSync } from "node:child_process";

/**
 * Open a new Terminal.app window attached to a tmux session.
 * Closing the Terminal window will detach (not kill) the tmux session.
 */
export function openTerminalAttached(sessionName: string): void {
  const script = `
    tell application "Terminal"
      activate
      do script "tmux attach -t ${sessionName}"
    end tell
  `;
  execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
    timeout: 10000,
    stdio: "ignore",
  });
}
