import { execSync, execFileSync } from "node:child_process";

export interface TmuxSessionInfo {
  name: string;
  created: number;
  attached: boolean;
}

/** List all tmux sessions matching a prefix. */
export function listSessions(prefix: string): TmuxSessionInfo[] {
  try {
    const output = execSync(
      `tmux list-sessions -F "#{session_name}\t#{session_created}\t#{session_attached}"`,
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "ignore"] },
    );
    return output
      .trim()
      .split("\n")
      .filter((l) => l.length > 0)
      .map((line) => {
        const [name, created, attached] = line.split("\t");
        return { name, created: parseInt(created, 10), attached: attached !== "0" };
      })
      .filter((s) => s.name.startsWith(prefix));
  } catch {
    return [];
  }
}

/** Create a new tmux session running claude in the given directory. */
export function createSession(
  sessionName: string,
  cwd: string,
  claudeBinary: string,
  title: string,
): void {
  // Set terminal title via printf escape, then exec claude
  const shellCmd = `printf '\\033]2;${title.replace(/'/g, "'\\''")}\\033\\\\' && exec ${claudeBinary}`;
  execFileSync("tmux", [
    "new-session",
    "-d",
    "-s", sessionName,
    "-c", cwd,
    "bash", "-c", shellCmd,
  ], { timeout: 10000, stdio: "ignore" });
}

/** Kill a tmux session by name. */
export function killSession(sessionName: string): void {
  try {
    execFileSync("tmux", ["kill-session", "-t", sessionName], {
      timeout: 5000, stdio: "ignore",
    });
  } catch {
    // Session might already be dead
  }
}

/** Check if tmux server is running. */
export function isTmuxAvailable(): boolean {
  try {
    execSync("tmux has-session", { timeout: 3000, stdio: "ignore" });
    return true;
  } catch {
    // tmux server may not be running yet, that's fine
    return false;
  }
}
