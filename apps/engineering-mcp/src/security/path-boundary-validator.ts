import path from "node:path";
import fs from "node:fs";
import { McpPlatformError } from "@mcp-platform/core";
import { UnsafeFilePolicy } from "@mcp-platform/repository-intelligence";

export class PathBoundaryValidator {
  public static validateRepositoryRoot(rawPath: string): string {
    if (!rawPath || typeof rawPath !== "string" || rawPath.trim().length === 0) {
      throw new McpPlatformError({
        code: "INVALID_REPOSITORY_ROOT",
        message: "Repository root path is required and cannot be empty.",
      });
    }

    const trimmed = rawPath.trim();

    // Check for null bytes or invalid control chars
    if (trimmed.includes("\0")) {
      throw new McpPlatformError({
        code: "PATH_TRAVERSAL_DETECTED",
        message: "Repository path contains null bytes or illegal control characters.",
      });
    }

    // Check for UNC path escapes (e.g. \\server\share)
    if (trimmed.startsWith("\\\\") || trimmed.startsWith("//")) {
      throw new McpPlatformError({
        code: "PATH_TRAVERSAL_DETECTED",
        message: "UNC path escapes are forbidden.",
      });
    }

    const resolved = path.resolve(trimmed);

    // Verify directory exists
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        throw new McpPlatformError({
          code: "INVALID_REPOSITORY_ROOT",
          message: `Repository path '${resolved}' is not a directory.`,
        });
      }
    } catch (err: unknown) {
      if (err instanceof McpPlatformError) throw err;
      throw new McpPlatformError({
        code: "INVALID_REPOSITORY_ROOT",
        message: `Repository root '${resolved}' does not exist or is not accessible.`,
      });
    }

    // Canonicalize with realpath
    try {
      const canonical = fs.realpathSync(resolved);
      return canonical;
    } catch {
      return resolved;
    }
  }

  public static validatePathWithinRoot(targetPath: string, rootPath: string): string {
    const canonicalRoot = this.validateRepositoryRoot(rootPath);
    const resolvedTarget = path.resolve(canonicalRoot, targetPath);

    // Normalize for comparison
    const normalizedRoot = canonicalRoot.replace(/\\/g, "/").toLowerCase();
    const normalizedTarget = resolvedTarget.replace(/\\/g, "/").toLowerCase();

    // Ensure target path stays inside canonical root
    if (!normalizedTarget.startsWith(normalizedRoot)) {
      throw new McpPlatformError({
        code: "PATH_TRAVERSAL_DETECTED",
        message: `Target path '${targetPath}' escapes the repository boundary '${rootPath}'.`,
      });
    }

    // Reject traversal patterns
    if (targetPath.includes("..") && !resolvedTarget.startsWith(canonicalRoot)) {
      throw new McpPlatformError({
        code: "PATH_TRAVERSAL_DETECTED",
        message: `Path traversal pattern detected in '${targetPath}'.`,
      });
    }

    // Check against UnsafeFilePolicy (sensitive files: .ssh, id_rsa, master.key, etc.)
    if (!UnsafeFilePolicy.isSafePath(resolvedTarget, canonicalRoot)) {
      throw new McpPlatformError({
        code: "FORBIDDEN_SENSITIVE_PATH",
        message: `Access to sensitive path '${targetPath}' is blocked by security policy.`,
      });
    }

    return resolvedTarget;
  }
}
