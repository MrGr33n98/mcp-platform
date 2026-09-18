import type { VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class PolicyValidator {
  public static validate(slicePlan: VerticalSlicePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const hasControllers = slicePlan.controllers.length > 0;
    const hasPolicies = slicePlan.policies.length > 0;

    // 1. Mandatory Policy for API Controllers
    const policySatisfied = !hasControllers || hasPolicies;
    checks.push({
      id: "POL-001-MANDATORY-POLICY",
      name: "Tenant-Scoped Endpoint Policy Enforcement",
      category: "AUTHORIZATION_POLICY",
      status: "STATIC",
      verdict: policySatisfied ? "PASS" : "FAIL",
      severity: policySatisfied ? "INFO" : "BLOCKER",
      message: policySatisfied
        ? `All ${slicePlan.controllers.length} controllers are backed by ${slicePlan.policies.length} Pundit authorization policies.`
        : "Controllers exposed without corresponding Pundit authorization policies (NO POLICY -> NO TENANT-SCOPED ENDPOINT violation)."
    });

    // 2. Cross-Tenant Isolation Scope Verification
    for (const policy of slicePlan.policies) {
      const hasTenantScope = policy.codePreview.includes("class Scope <") && policy.codePreview.includes("scope.where(");
      checks.push({
        id: `POL-002-SCOPE-${policy.name}`,
        name: `Multi-Tenant Isolation Scope: ${policy.name}`,
        category: "AUTHORIZATION_POLICY",
        status: "STATIC",
        verdict: hasTenantScope ? "PASS" : "FAIL",
        severity: hasTenantScope ? "INFO" : "BLOCKER",
        message: hasTenantScope
          ? `Policy '${policy.name}' defines strict multi-tenant Scope resolution.`
          : `Policy '${policy.name}' missing multi-tenant Scope resolution.`
      });
    }

    // 3. Controller Policy Check Integration
    for (const ctrl of slicePlan.controllers) {
      const usesPolicyScope = ctrl.codePreview.includes("policy_scope(");
      const usesAuthorize = ctrl.codePreview.includes("authorize ");
      const integratesPundit = usesPolicyScope || usesAuthorize;

      checks.push({
        id: `POL-003-CTRL-CHECK-${ctrl.name}`,
        name: `Controller Pundit Invocations: ${ctrl.name}`,
        category: "AUTHORIZATION_POLICY",
        status: "STATIC",
        verdict: integratesPundit ? "PASS" : "FAIL",
        severity: integratesPundit ? "INFO" : "BLOCKER",
        message: integratesPundit
          ? `Controller '${ctrl.name}' actively invokes Pundit policy checks (policy_scope / authorize).`
          : `Controller '${ctrl.name}' exposes actions without invoking Pundit policy checks.`
      });
    }

    return checks;
  }
}
