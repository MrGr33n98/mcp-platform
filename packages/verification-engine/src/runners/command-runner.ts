import { exec } from "child_process";
import { promisify } from "util";
import { CommandPolicy } from "../security/command-policy.js";
import { EnvironmentPolicy } from "../security/environment-policy.js";
import { OutputSanitizer } from "../security/output-sanitizer.js";

const execAsync = promisify(exec);

export interface ExecutionResult {
  command: string;
  allowed: boolean;
  status: "OK" | "FAILED" | "BLOCKED";
  exitCode: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  blockReason?: string | undefined;
}

export class CommandRunner {
  public static async runCommand(
    command: string,
    workspaceCwd: string,
    timeoutMs = 30_000
  ): Promise<ExecutionResult> {
    const policyResult = CommandPolicy.evaluateCommand(command);

    if (!policyResult.allowed) {
      return {
        command,
        allowed: false,
        status: "BLOCKED",
        exitCode: 1,
        stdout: "",
        stderr: policyResult.reason || "Command blocked by security policy.",
        duration_ms: 0,
        blockReason: policyResult.reason
      };
    }

    const envCheck = EnvironmentPolicy.evaluateEnvironment(process.env);
    if (!envCheck.allowed) {
      return {
        command,
        allowed: false,
        status: "BLOCKED",
        exitCode: 1,
        stdout: "",
        stderr: envCheck.reason || "Environment contains forbidden production credentials.",
        duration_ms: 0,
        blockReason: envCheck.reason
      };
    }

    const safeEnv = EnvironmentPolicy.sanitizeEnvironmentForExecution(process.env);
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspaceCwd,
        env: safeEnv,
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024 // 2MB
      });

      const duration = Date.now() - startTime;
      return {
        command,
        allowed: true,
        status: "OK",
        exitCode: 0,
        stdout: OutputSanitizer.sanitize(stdout),
        stderr: OutputSanitizer.sanitize(stderr),
        duration_ms: duration
      };
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const errorObj = err as { code?: number; stdout?: string; stderr?: string; message?: string };

      return {
        command,
        allowed: true,
        status: "FAILED",
        exitCode: typeof errorObj.code === "number" ? errorObj.code : 1,
        stdout: OutputSanitizer.sanitize(errorObj.stdout || ""),
        stderr: OutputSanitizer.sanitize(errorObj.stderr || errorObj.message || "Execution error"),
        duration_ms: duration
      };
    }
  }
}
