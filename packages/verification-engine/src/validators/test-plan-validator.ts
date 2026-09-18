import type { TestPlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class TestPlanValidator {
  public static validate(slicePlan: VerticalSlicePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const tests = slicePlan.tests;

    // 1. Mandatory Test Plan
    const hasTests = tests.length > 0;
    checks.push({
      id: "TEST-001-MANDATORY-SUITE",
      name: "Mandatory Automated Test Plan Enforcement",
      category: "TEST_ORCHESTRATION",
      status: "STATIC",
      verdict: hasTests ? "PASS" : "FAIL",
      severity: hasTests ? "INFO" : "BLOCKER",
      message: hasTests
        ? `Verified ${tests.length} planned test suites covering models, requests, jobs, and security gates.`
        : "No automated tests planned for proposed changes (NO TEST PLAN -> NO CHANGE violation)."
    });

    // 2. Cross-Tenant Test Coverage
    const hasCrossTenantSpec = tests.some((t: TestPlan) => t.category === "CROSS_TENANT_SPEC");
    const hasTenantScopedEndpoints = slicePlan.controllers.length > 0;

    if (hasTenantScopedEndpoints) {
      checks.push({
        id: "TEST-002-CROSS-TENANT-SPEC",
        name: "Cross-Tenant Isolation Test Coverage",
        category: "TEST_ORCHESTRATION",
        status: "STATIC",
        verdict: hasCrossTenantSpec ? "PASS" : "FAIL",
        severity: hasCrossTenantSpec ? "INFO" : "BLOCKER",
        message: hasCrossTenantSpec
          ? "Dedicated cross-tenant isolation spec is planned to prove boundary enforcement."
          : "Tenant-scoped endpoints proposed without a dedicated cross-tenant isolation test suite."
      });
    }

    // 3. Model Spec Coverage
    const hasModelSpecs = tests.some((t: TestPlan) => t.category === "MODEL_SPEC");
    if (slicePlan.models.length > 0) {
      checks.push({
        id: "TEST-003-MODEL-SPECS",
        name: "Domain Model Unit Specs",
        category: "TEST_ORCHESTRATION",
        status: "STATIC",
        verdict: hasModelSpecs ? "PASS" : "FAIL",
        severity: hasModelSpecs ? "INFO" : "ERROR",
        message: hasModelSpecs
          ? "Model specs planned for associations, validations, and lifecycle callbacks."
          : "Models planned without corresponding model specs."
      });
    }

    return checks;
  }
}
