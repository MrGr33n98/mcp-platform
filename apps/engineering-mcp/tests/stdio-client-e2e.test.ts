import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";

describe("Engineering MCP Server Compiled STDIO Protocol E2E", () => {
  it("initializes compiled dist/index.js and returns all 19 registered tools via tools/list", async () => {
    const serverDistPath = path.resolve(__dirname, "../dist/index.js");

    const serverProcess = spawn(process.execPath, [serverDistPath], {
      cwd: path.resolve(__dirname, "../../../"),
      env: {
        ...process.env,
        MCP_LOG_LEVEL: "error",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutData = "";
    let stderrData = "";

    serverProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    serverProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    const sendRpc = (msg: object) => {
      serverProcess.stdin.write(JSON.stringify(msg) + "\n");
    };

    // 1. Initialize
    sendRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    // 2. Initialized notification
    sendRpc({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    // 3. Tools list request
    sendRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    // Wait for responses
    const responses: any[] = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for JSON-RPC responses. Stdout: '${stdoutData}', Stderr: '${stderrData}'`));
      }, 5000);

      const interval = setInterval(() => {
        const lines = stdoutData.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length >= 2) {
          clearTimeout(timeout);
          clearInterval(interval);
          cleanup();
          try {
            const parsed = lines.map((l) => JSON.parse(l));
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        }
      }, 100);

      function cleanup() {
        serverProcess.stdin.end();
        serverProcess.kill();
      }
    });

    // Verify response 1: initialize
    const initResponse = responses.find((r) => r.id === 1);
    expect(initResponse).toBeDefined();
    expect(initResponse.result).toBeDefined();
    expect(initResponse.result.serverInfo.name).toBe("mcp-platform-engineering");

    // Verify response 2: tools/list
    const toolsListResponse = responses.find((r) => r.id === 2);
    expect(toolsListResponse).toBeDefined();
    expect(toolsListResponse.result).toBeDefined();
    expect(toolsListResponse.result.tools).toBeDefined();

    const toolNames = toolsListResponse.result.tools.map((t: any) => t.name).sort();
    expect(toolNames.length).toBe(19);

    const expectedTools = [
      "engineering_get_platform_info",
      "engineering_list_capabilities",
      "engineering_scan_repository",
      "engineering_get_repository_evidence",
      "engineering_build_architecture_graph",
      "engineering_analyze_saas_gaps",
      "engineering_plan_feature",
      "engineering_analyze_blast_radius",
      "engineering_verify_change",
      "engineering_preview_apply",
      "engineering_apply_change",
      "engineering_rollback_apply",
      "engineering_git_status",
      "engineering_prepare_branch",
      "engineering_prepare_commit",
      "engineering_diagnose_production",
      "engineering_release_plan",
      "engineering_verify_release",
      "engineering_rollback_release",
    ].sort();

    expect(toolNames).toEqual(expectedTools);
  });
});
