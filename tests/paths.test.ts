import { describe, it, expect } from "vitest";
import { worktreeKey } from "../src/lib/paths.js";

describe("worktreeKey", () => {
  it("returns basename for simple paths", () => {
    expect(worktreeKey({ path: "/home/user/my-project", label: "" })).toBe("my-project");
  });

  it("replaces special characters with underscores", () => {
    expect(worktreeKey({ path: "/home/user/my project!", label: "" })).toBe("my_project");
  });

  it("preserves hyphens and underscores", () => {
    expect(worktreeKey({ path: "/home/user/my_cool-project", label: "" })).toBe("my_cool-project");
  });

  it("strips trailing underscores", () => {
    expect(worktreeKey({ path: "/home/user/project@", label: "" })).toBe("project");
  });

  it("handles paths with dots", () => {
    expect(worktreeKey({ path: "/home/user/my.project", label: "" })).toBe("my_project");
  });

  it("handles trailing slash by using parent dir basename", () => {
    // basename("/foo/bar/") returns "bar"
    expect(worktreeKey({ path: "/foo/bar/", label: "" })).toBe("bar");
  });

  it("handles multiple consecutive special characters", () => {
    expect(worktreeKey({ path: "/home/user/a@@b", label: "" })).toBe("a__b");
  });
});
