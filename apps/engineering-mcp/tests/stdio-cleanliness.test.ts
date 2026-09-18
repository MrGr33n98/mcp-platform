import { describe, it, expect, vi } from "vitest";
import { ConsoleLogger } from "@mcp-platform/core";

describe("Engineering MCP STDIO Cleanliness", () => {
  it("routes all logger messages to stderr and keeps stdout untouched", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const logger = new ConsoleLogger("info");
    logger.info("Test info message", { component: "test" });
    logger.warn("Test warning message");
    logger.error("Test error message");

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalled();

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});
