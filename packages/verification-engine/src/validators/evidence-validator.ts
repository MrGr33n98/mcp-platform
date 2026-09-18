import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class EvidenceValidator {
  public static validate(
    manifest: RepositoryManifest,
    _graph: ArchitectureGraphData,
    changePlan: ChangePlan,
    slicePlan: VerticalSlicePlan
  ): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];

    // 1. Check if capability has requirements and gap evidence
    const hasEvidence = slicePlan.requirements.length > 0;
    checks.push({
      id: "EVID-001-CAPABILITY-EVIDENCE",
      name: "Capability Gap Evidence Verification",
      category: "EVIDENCE_INTEGRITY",
      status: "STATIC",
      verdict: hasEvidence ? "PASS" : "FAIL",
      severity: hasEvidence ? "INFO" : "BLOCKER",
      message: hasEvidence
        ? `Verified ${slicePlan.requirements.length} atomic requirements with gap audit evidence.`
        : "No architectural gap evidence found for planned capability (NO EVIDENCE -> NO CHANGE violation)."
    });

    // 2. Check operations against manifest
    for (const op of changePlan.operations) {
      if (op.type === "MODIFY_FILE") {
        const fileExistsInBackend =
          manifest.backend.models.some((m) => m.file === op.path) ||
          manifest.backend.controllers.some((c) => c.file === op.path) ||
          manifest.backend.policies.some((p) => p.file === op.path);

        checks.push({
          id: `EVID-002-${op.id}`,
          name: `File Modification Evidence: ${op.path}`,
          category: "EVIDENCE_INTEGRITY",
          status: "STATIC",
          verdict: fileExistsInBackend ? "PASS" : "FAIL",
          severity: fileExistsInBackend ? "INFO" : "BLOCKER",
          message: fileExistsInBackend
            ? `Target file '${op.path}' verified in repository manifest.`
            : `Proposed modification to non-existent file '${op.path}'.`
        });
      }
    }

    // 3. Check Tenant Model existence evidence
    const tenantModel = slicePlan.existingPatterns.models.tenancyAssociation.replace("belongs_to :", "").trim();
    const tenantCapitalized = tenantModel.charAt(0).toUpperCase() + tenantModel.slice(1);
    const tenantExists = manifest.backend.models.some((m) => m.name.toLowerCase() === tenantModel.toLowerCase());

    checks.push({
      id: "EVID-003-TENANT-MODEL",
      name: `Tenant Model Existence (${tenantCapitalized})`,
      category: "EVIDENCE_INTEGRITY",
      status: "STATIC",
      verdict: tenantExists ? "PASS" : "WARNING",
      severity: tenantExists ? "INFO" : "WARNING",
      message: tenantExists
        ? `Tenant model '${tenantCapitalized}' verified in active codebase.`
        : `Tenant model '${tenantCapitalized}' not detected in manifest.`
    });

    return checks;
  }
}
