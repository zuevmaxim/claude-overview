import { describe, it, expect } from "vitest";
import { parseTmuxOutput } from "./tmux.js";

describe("parseTmuxOutput", () => {
  it("parses standard multi-session output", () => {
    const output = [
      "cov_main\t1700000000\t1",
      "cov_feature\t1700000100\t0",
      "other_session\t1700000200\t0",
    ].join("\n");

    const result = parseTmuxOutput(output, "cov_");
    expect(result).toEqual([
      { name: "cov_main", created: 1700000000, attached: true },
      { name: "cov_feature", created: 1700000100, attached: false },
    ]);
  });

  it("returns empty array for empty output", () => {
    expect(parseTmuxOutput("", "cov_")).toEqual([]);
  });

  it("returns empty array when no sessions match prefix", () => {
    const output = "other_session\t1700000000\t0\n";
    expect(parseTmuxOutput(output, "cov_")).toEqual([]);
  });

  it("handles trailing newlines", () => {
    const output = "cov_main\t1700000000\t1\n\n";
    const result = parseTmuxOutput(output, "cov_");
    expect(result).toEqual([
      { name: "cov_main", created: 1700000000, attached: true },
    ]);
  });

  it("correctly distinguishes attached vs detached", () => {
    const output = [
      "cov_attached\t1700000000\t1",
      "cov_detached\t1700000000\t0",
    ].join("\n");

    const result = parseTmuxOutput(output, "cov_");
    expect(result[0].attached).toBe(true);
    expect(result[1].attached).toBe(false);
  });
});
