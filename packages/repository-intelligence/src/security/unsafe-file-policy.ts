import path from "node:path";

export class UnsafeFilePolicy {
  public static isSafePath(targetPath: string, rootPath: string): boolean {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(rootPath);

    // Path traversal check
    if (!resolvedTarget.startsWith(resolvedRoot)) {
      return false;
    }

    // Reject system sensitive paths
    const lower = resolvedTarget.toLowerCase();
    if (
      lower.includes(".ssh") ||
      lower.includes("id_rsa") ||
      lower.includes(".gnupg") ||
      lower.includes("credentials.json") ||
      lower.includes("master.key")
    ) {
      return false;
    }

    return true;
  }

  public static isIgnored(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/");
    const ignoredSegments = [
      "/node_modules/",
      "/vendor/bundle/",
      "/vendor/cache/",
      "/.git/",
      "/.next/",
      "/dist/",
      "/build/",
      "/tmp/",
      "/log/",
      "/coverage/",
      "/storage/",
      "/.bundle/"
    ];

    return ignoredSegments.some((seg) => normalized.includes(seg) || normalized.endsWith(seg.replace(/\//g, "")));
  }
}
