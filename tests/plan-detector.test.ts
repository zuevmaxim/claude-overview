import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "node:fs";
import { detectPlanFile, clearPlanCache } from "../src/lib/plan-detector.js";

const mockExists = vi.mocked(existsSync);
const mockRead = vi.mocked(readFileSync);

beforeEach(() => {
  vi.resetAllMocks();
  clearPlanCache("sess-1");
  clearPlanCache("sess-2");
});

describe("detectPlanFile", () => {
  it("returns the last existing plan file from JSONL", () => {
    const jsonlPath = expect.stringContaining("sess-1.jsonl");
    mockExists.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("sess-1.jsonl")) return true;
      if (s === "/wt/.claude/plans/plan-v2.md") return true;
      return false;
    });

    const lines = [
      JSON.stringify({ type: "tool_use", name: "Write", input: { file_path: "/wt/.claude/plans/plan-v1.md" } }),
      JSON.stringify({ type: "tool_use", name: "Read", input: { file_path: "/wt/src/index.ts" } }),
      JSON.stringify({ type: "tool_use", name: "Write", input: { file_path: "/wt/.claude/plans/plan-v2.md" } }),
    ];
    mockRead.mockReturnValue(lines.join("\n"));

    const result = detectPlanFile("/wt", "sess-1");
    expect(result).toBe("/wt/.claude/plans/plan-v2.md");
  });

  it("returns null when JSONL file does not exist", () => {
    mockExists.mockReturnValue(false);

    const result = detectPlanFile("/wt", "sess-1");
    expect(result).toBeNull();
  });

  it("ignores Write entries that are not plan files", () => {
    mockExists.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith("sess-1.jsonl");
    });

    const lines = [
      JSON.stringify({ type: "tool_use", name: "Write", input: { file_path: "/wt/src/main.ts" } }),
      JSON.stringify({ type: "tool_use", name: "Write", input: { file_path: "/wt/.claude/plans/readme.txt" } }),
    ];
    mockRead.mockReturnValue(lines.join("\n"));

    expect(detectPlanFile("/wt", "sess-1")).toBeNull();
  });

  it("skips malformed JSON lines", () => {
    mockExists.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("sess-1.jsonl")) return true;
      if (s === "/wt/.claude/plans/good.md") return true;
      return false;
    });

    const lines = [
      "not valid json{{{",
      "",
      JSON.stringify({ type: "tool_use", name: "Write", input: { file_path: "/wt/.claude/plans/good.md" } }),
    ];
    mockRead.mockReturnValue(lines.join("\n"));

    expect(detectPlanFile("/wt", "sess-1")).toBe("/wt/.claude/plans/good.md");
  });

  it("returns null when plan files are in JSONL but none exist on disk", () => {
    mockExists.mockImplementation((p) => {
      return String(p).endsWith("sess-1.jsonl");
    });

    const lines = [
      JSON.stringify({ type: "tool_use", name: "Write", input: { file_path: "/wt/.claude/plans/deleted.md" } }),
    ];
    mockRead.mockReturnValue(lines.join("\n"));

    expect(detectPlanFile("/wt", "sess-1")).toBeNull();
  });

  it("uses cache on subsequent calls within TTL", () => {
    mockExists.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("sess-2.jsonl")) return true;
      if (s === "/wt/.claude/plans/cached.md") return true;
      return false;
    });
    const lines = [
      JSON.stringify({ type: "tool_use", name: "Write", input: { file_path: "/wt/.claude/plans/cached.md" } }),
    ];
    mockRead.mockReturnValue(lines.join("\n"));

    // First call reads from disk
    const first = detectPlanFile("/wt", "sess-2");
    expect(first).toBe("/wt/.claude/plans/cached.md");
    expect(mockRead).toHaveBeenCalledTimes(1);

    // Second call uses cache
    const second = detectPlanFile("/wt", "sess-2");
    expect(second).toBe("/wt/.claude/plans/cached.md");
    expect(mockRead).toHaveBeenCalledTimes(1); // not called again
  });

  it("clearPlanCache invalidates the cache", () => {
    mockExists.mockReturnValue(false);

    detectPlanFile("/wt", "sess-1");
    expect(mockExists).toHaveBeenCalled();

    mockExists.mockClear();
    // Cached — should not read again
    detectPlanFile("/wt", "sess-1");
    expect(mockExists).not.toHaveBeenCalled();

    // Clear and retry — should read again
    clearPlanCache("sess-1");
    detectPlanFile("/wt", "sess-1");
    expect(mockExists).toHaveBeenCalled();
  });
});
