import { describe, it, expect } from "vitest";
import { parseWorktreePorcelain } from "./config.js";

describe("parseWorktreePorcelain", () => {
  it("parses a single worktree", () => {
    const output = [
      "worktree /home/user/repo",
      "HEAD abc1234",
      "branch refs/heads/main",
      "",
    ].join("\n");

    expect(parseWorktreePorcelain(output)).toEqual([
      { path: "/home/user/repo", label: "repo", branch: "main" },
    ]);
  });

  it("parses multiple worktrees", () => {
    const output = [
      "worktree /home/user/repo",
      "HEAD abc1234",
      "branch refs/heads/main",
      "",
      "worktree /home/user/repo-feature",
      "HEAD def5678",
      "branch refs/heads/feature/cool",
      "",
    ].join("\n");

    const result = parseWorktreePorcelain(output);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ path: "/home/user/repo", label: "repo", branch: "main" });
    expect(result[1]).toEqual({ path: "/home/user/repo-feature", label: "repo-feature", branch: "feature/cool" });
  });

  it("handles detached HEAD (no branch)", () => {
    const output = [
      "worktree /home/user/repo-detached",
      "HEAD abc1234",
      "detached",
      "",
    ].join("\n");

    const result = parseWorktreePorcelain(output);
    expect(result).toEqual([
      { path: "/home/user/repo-detached", label: "repo-detached", branch: undefined },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseWorktreePorcelain("")).toEqual([]);
  });

  it("strips refs/heads/ prefix from branch names", () => {
    const output = [
      "worktree /repo",
      "HEAD abc1234",
      "branch refs/heads/feature/my-branch",
      "",
    ].join("\n");

    const result = parseWorktreePorcelain(output);
    expect(result[0].branch).toBe("feature/my-branch");
  });
});
