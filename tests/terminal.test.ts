import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { openTerminalAttached } from "../src/lib/terminal.js";

describe("openTerminalAttached", () => {
  it("rejects session names with spaces", () => {
    expect(() => openTerminalAttached("bad name")).toThrow("Invalid session name");
  });

  it("rejects session names with special characters", () => {
    expect(() => openTerminalAttached("bad;name")).toThrow("Invalid session name");
    expect(() => openTerminalAttached("bad$(cmd)")).toThrow("Invalid session name");
    expect(() => openTerminalAttached("bad`cmd`")).toThrow("Invalid session name");
  });

  it("accepts valid session names with alphanumeric, hyphens, underscores", () => {
    expect(() => openTerminalAttached("cov_my-session_1")).not.toThrow();
  });
});
