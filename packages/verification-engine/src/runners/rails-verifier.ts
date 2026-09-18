import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { VerificationCheckResult } from "../types.js";

export class RailsVerifier {
  public static verifyStatic(manifest: RepositoryManifest): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];

    const isRails = manifest.stack.backend === "rails" || manifest.backend.framework.includes("rails");
    checks.push({
      id: "RAILS-001-FRAMEWORK",
      name: "Rails Backend Framework Detection",
      category: "RAILS_PROFILE",
      status: "STATIC",
      verdict: isRails ? "PASS" : "FAIL",
      severity: isRails ? "INFO" : "BLOCKER",
      message: isRails
        ? `Rails backend verified (${manifest.versions?.["rails"] || "Version detected"})`
        : "Backend is not a recognized Rails application."
    });

    const hasModels = manifest.backend.models.length > 0;
    checks.push({
      id: "RAILS-002-MODELS",
      name: "ActiveRecord Domain Models",
      category: "RAILS_PROFILE",
      status: "STATIC",
      verdict: hasModels ? "PASS" : "WARNING",
      severity: hasModels ? "INFO" : "WARNING",
      message: `${manifest.backend.models.length} domain models discovered.`
    });

    const hasControllers = manifest.backend.controllers.length > 0;
    checks.push({
      id: "RAILS-003-CONTROLLERS",
      name: "ActionController Handlers",
      category: "RAILS_PROFILE",
      status: "STATIC",
      verdict: hasControllers ? "PASS" : "WARNING",
      severity: hasControllers ? "INFO" : "WARNING",
      message: `${manifest.backend.controllers.length} controllers discovered.`
    });

    return checks;
  }
}
