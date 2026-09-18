import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { VerificationCheckResult } from "../types.js";

export class NextVerifier {
  public static verifyStatic(manifest: RepositoryManifest): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const hasNext = manifest.stack.frontend === "nextjs" || manifest.frontend.framework.includes("next");

    checks.push({
      id: "NEXT-001-FRAMEWORK",
      name: "Next.js Frontend Detection",
      category: "NEXT_PROFILE",
      status: "STATIC",
      verdict: "PASS",
      severity: "INFO",
      message: hasNext ? "Next.js frontend detected." : "No Next.js frontend required by repository architecture."
    });

    return checks;
  }
}
