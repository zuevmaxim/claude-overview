import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "node:fs";
import { detectSessionState, stateFilePath } from "./state-detector.js";

const mockExists = vi.mocked(existsSync);
const mockRead = vi.mocked(readFileSync);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("stateFilePath", () => {
  it("returns path under STATE_DIR with .json suffix", () => {
    const path = stateFilePath("my-project");
    expect(path).toMatch(/sessions\/my-project\.json$/);
  });
});

describe("detectSessionState", () => {
  it("returns unknown when state file does not exist", () => {
    mockExists.mockReturnValue(false);

    const result = detectSessionState("missing-key");
    expect(result.state).toBe("unknown");
    expect(result.stateUpdatedAt).toBeGreaterThan(0);
  });

  it("reads state from a valid hook state file", () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue(JSON.stringify({
      state: "running",
      timestamp: 1700000000,
      sessionId: "abc-123",
    }));

    const result = detectSessionState("my-key");
    expect(result.state).toBe("running");
    expect(result.stateUpdatedAt).toBe(1700000000);
    expect(result.sessionId).toBe("abc-123");
  });

  it("returns waiting state with no sessionId when absent", () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue(JSON.stringify({
      state: "waiting",
      timestamp: 1700000500,
    }));

    const result = detectSessionState("my-key");
    expect(result.state).toBe("waiting");
    expect(result.sessionId).toBeUndefined();
  });

  it("returns unknown when file contains invalid JSON", () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue("not json");

    const result = detectSessionState("broken-key");
    expect(result.state).toBe("unknown");
  });
});
