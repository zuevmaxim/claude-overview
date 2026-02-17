import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Config, WorktreeInfo } from "./types.js";

const WorktreeSchema = z.object({
  path: z.string(),
  label: z.string(),
  branch: z.string().optional(),
});

const ConfigSchema = z.object({
  worktrees: z.array(WorktreeSchema).default([]),
  worktreeDiscovery: z
    .object({
      enabled: z.boolean().default(false),
      repoPath: z.string().optional(),
    })
    .default({ enabled: false }),
  tmuxPrefix: z.string().default("cov_"),
  pollIntervalMs: z.number().default(1500),
  claudeBinary: z.string().default("claude"),
});

const CONFIG_FILENAMES = [
  "claude-overview.config.json",
  ".claude-overview.json",
];

function findConfigFile(): string | null {
  // Check CWD
  for (const name of CONFIG_FILENAMES) {
    const p = resolve(name);
    if (existsSync(p)) return p;
  }
  // Check ~/.config/claude-overview/
  const configDir = join(homedir(), ".config", "claude-overview");
  const globalPath = join(configDir, "config.json");
  if (existsSync(globalPath)) return globalPath;

  return null;
}

/** Parse `git worktree list --porcelain` output into structured data. */
export function parseWorktreePorcelain(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) {
        worktrees.push({
          path: current.path,
          label: current.label ?? current.path.split("/").pop()!,
          branch: current.branch,
        });
      }
      current = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("branch ")) {
      const branch = line.slice("branch ".length);
      current.branch = branch.replace("refs/heads/", "");
      current.label = current.branch;
    }
  }
  // Push last entry
  if (current.path) {
    worktrees.push({
      path: current.path,
      label: current.label ?? current.path.split("/").pop()!,
      branch: current.branch,
    });
  }

  return worktrees;
}

function discoverWorktrees(repoPath: string): WorktreeInfo[] {
  try {
    const output = execSync("git worktree list --porcelain", {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "ignore"],
    });
    return parseWorktreePorcelain(output);
  } catch {
    return [];
  }
}

export function loadConfig(configPath?: string): Config {
  const filePath = configPath ?? findConfigFile();
  let raw: unknown = {};

  if (filePath && existsSync(filePath)) {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  }

  const config = ConfigSchema.parse(raw);

  // Auto-discover worktrees from explicit repoPath or CWD
  const discoveryPath = config.worktreeDiscovery.enabled && config.worktreeDiscovery.repoPath
    ? config.worktreeDiscovery.repoPath
    : process.cwd();

  const discovered = discoverWorktrees(discoveryPath);
  const existingPaths = new Set(config.worktrees.map((w) => w.path));
  for (const wt of discovered) {
    if (!existingPaths.has(wt.path)) {
      config.worktrees.push(wt);
    }
  }

  return config;
}
