import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncSettingsAllow } from "./settings-sync.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const mockExists = vi.mocked(existsSync);
const mockRead = vi.mocked(readFileSync);
const mockWrite = vi.mocked(writeFileSync);

/** Helper: make existsSync return true for the given paths. */
function filesOnDisk(paths: string[]) {
  const set = new Set(paths);
  mockExists.mockImplementation((p) => set.has(String(p)));
}

/** Helper: map file paths to their JSON content. */
function fileContents(map: Record<string, unknown>) {
  mockRead.mockImplementation((p) => {
    const content = map[String(p)];
    if (content === undefined) throw new Error(`ENOENT: ${String(p)}`);
    return JSON.stringify(content);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncSettingsAllow", () => {
  it("merges allow lists from two worktrees", () => {
    const pathA = "/a/.claude/settings.json";
    const pathB = "/b/.claude/settings.json";

    filesOnDisk([pathA, pathB]);
    fileContents({
      [pathA]: { permissions: { allow: ["tool1", "tool2"] } },
      [pathB]: { permissions: { allow: ["tool2", "tool3"] } },
    });

    syncSettingsAllow(["/a", "/b"]);

    expect(mockWrite).toHaveBeenCalledTimes(2);

    const writtenA = JSON.parse(String(mockWrite.mock.calls[0][1]));
    const writtenB = JSON.parse(String(mockWrite.mock.calls[1][1]));

    // A gets tool3 appended
    expect(writtenA.permissions.allow).toEqual(["tool1", "tool2", "tool3"]);
    // B gets tool1 appended
    expect(writtenB.permissions.allow).toEqual(["tool2", "tool3", "tool1"]);
  });

  it("does nothing when all worktrees already have the same entries", () => {
    const pathA = "/a/.claude/settings.json";
    const pathB = "/b/.claude/settings.json";

    filesOnDisk([pathA, pathB]);
    fileContents({
      [pathA]: { permissions: { allow: ["x"] } },
      [pathB]: { permissions: { allow: ["x"] } },
    });

    syncSettingsAllow(["/a", "/b"]);

    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("handles a worktree with no settings file", () => {
    const pathA = "/a/.claude/settings.json";

    // Only A exists on disk; B has neither settings.local.json nor settings.json
    filesOnDisk([pathA]);
    fileContents({
      [pathA]: { permissions: { allow: ["tool1"] } },
    });

    syncSettingsAllow(["/a", "/b"]);

    // B's settings file (/b/.claude/settings.json) should be written with tool1
    expect(mockWrite).toHaveBeenCalledTimes(1);
    const written = JSON.parse(String(mockWrite.mock.calls[0][1]));
    expect(written.permissions.allow).toEqual(["tool1"]);
    // Written to B's default settings path
    expect(mockWrite.mock.calls[0][0]).toBe("/b/.claude/settings.json");
  });

  it("prefers settings.local.json when it exists", () => {
    const localPath = "/a/.claude/settings.local.json";
    const regularPath = "/b/.claude/settings.json";

    filesOnDisk([localPath, regularPath]);
    fileContents({
      [localPath]: { permissions: { allow: ["local-tool"] } },
      [regularPath]: { permissions: { allow: ["regular-tool"] } },
    });

    syncSettingsAllow(["/a", "/b"]);

    // Both files should be updated
    expect(mockWrite).toHaveBeenCalledTimes(2);
    // A's local file gets written
    expect(mockWrite.mock.calls[0][0]).toBe(localPath);
    // B's regular file gets written
    expect(mockWrite.mock.calls[1][0]).toBe(regularPath);
  });

  it("preserves other settings keys when writing", () => {
    const pathA = "/a/.claude/settings.json";
    const pathB = "/b/.claude/settings.json";

    filesOnDisk([pathA, pathB]);
    fileContents({
      [pathA]: {
        theme: "dark",
        permissions: { allow: ["tool1"], deny: ["bad"] },
      },
      [pathB]: { permissions: { allow: ["tool2"] } },
    });

    syncSettingsAllow(["/a", "/b"]);

    const writtenA = JSON.parse(String(mockWrite.mock.calls[0][1]));
    expect(writtenA.theme).toBe("dark");
    expect(writtenA.permissions.deny).toEqual(["bad"]);
    expect(writtenA.permissions.allow).toEqual(["tool1", "tool2"]);
  });

  it("handles invalid JSON gracefully (treats as empty settings)", () => {
    const pathA = "/a/.claude/settings.json";
    const pathB = "/b/.claude/settings.json";

    filesOnDisk([pathA, pathB]);
    // A has valid JSON, B has broken JSON
    mockRead.mockImplementation((p) => {
      if (String(p) === pathA)
        return JSON.stringify({ permissions: { allow: ["tool1"] } });
      return "not valid json{{{";
    });

    syncSettingsAllow(["/a", "/b"]);

    // B should be written with tool1 (since its broken JSON is treated as {})
    expect(mockWrite).toHaveBeenCalledTimes(1);
    const written = JSON.parse(String(mockWrite.mock.calls[0][1]));
    expect(written.permissions.allow).toEqual(["tool1"]);
  });

  it("handles a single worktree (no-op)", () => {
    const pathA = "/a/.claude/settings.json";

    filesOnDisk([pathA]);
    fileContents({
      [pathA]: { permissions: { allow: ["tool1"] } },
    });

    syncSettingsAllow(["/a"]);

    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("handles worktrees with no permissions.allow field", () => {
    const pathA = "/a/.claude/settings.json";
    const pathB = "/b/.claude/settings.json";

    filesOnDisk([pathA, pathB]);
    fileContents({
      [pathA]: { permissions: { allow: ["tool1"] } },
      [pathB]: { theme: "light" },
    });

    syncSettingsAllow(["/a", "/b"]);

    // B should get tool1 added
    expect(mockWrite).toHaveBeenCalledTimes(1);
    const written = JSON.parse(String(mockWrite.mock.calls[0][1]));
    expect(written.permissions.allow).toEqual(["tool1"]);
    expect(written.theme).toBe("light");
  });

  it("merges across three worktrees", () => {
    const pathA = "/a/.claude/settings.json";
    const pathB = "/b/.claude/settings.json";
    const pathC = "/c/.claude/settings.json";

    filesOnDisk([pathA, pathB, pathC]);
    fileContents({
      [pathA]: { permissions: { allow: ["a"] } },
      [pathB]: { permissions: { allow: ["b"] } },
      [pathC]: { permissions: { allow: ["c"] } },
    });

    syncSettingsAllow(["/a", "/b", "/c"]);

    expect(mockWrite).toHaveBeenCalledTimes(3);

    const writtenA = JSON.parse(String(mockWrite.mock.calls[0][1]));
    const writtenB = JSON.parse(String(mockWrite.mock.calls[1][1]));
    const writtenC = JSON.parse(String(mockWrite.mock.calls[2][1]));

    expect(writtenA.permissions.allow).toEqual(["a", "b", "c"]);
    expect(writtenB.permissions.allow).toEqual(["b", "a", "c"]);
    expect(writtenC.permissions.allow).toEqual(["c", "a", "b"]);
  });

  it("handles empty worktree list", () => {
    syncSettingsAllow([]);
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
