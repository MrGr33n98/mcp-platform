import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class PatternValidator {
  public static validate(changePlan: ChangePlan, slicePlan: VerticalSlicePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const patterns = slicePlan.existingPatterns;

    // 1. Validate Job Base Class Pattern
    for (const job of slicePlan.jobs) {
      const usesExpectedBase = job.codePreview.includes(`< ${patterns.jobs.baseClass}`);
      checks.push({
        id: `PAT-001-JOB-${job.name}`,
        name: `Job Base Class Convention: ${job.name}`,
        category: "PATTERN_CONFORMANCE",
        status: "STATIC",
        verdict: usesExpectedBase ? "PASS" : "FAIL",
        severity: usesExpectedBase ? "INFO" : "ERROR",
        message: usesExpectedBase
          ? `Job '${job.name}' adheres to dominant base class '${patterns.jobs.baseClass}'.`
          : `Job '${job.name}' diverges from project base class '${patterns.jobs.baseClass}'.`
      });
    }

    // 2. Validate Policy Pattern
    for (const policy of slicePlan.policies) {
      const usesExpectedBase = policy.codePreview.includes(`< ${patterns.policies.baseClass}`);
      const usesScope = policy.codePreview.includes("class Scope <");
      const adheres = usesExpectedBase && usesScope;

      checks.push({
        id: `PAT-002-POLICY-${policy.name}`,
        name: `Policy Inheritance and Scope Convention: ${policy.name}`,
        category: "PATTERN_CONFORMANCE",
        status: "STATIC",
        verdict: adheres ? "PASS" : "FAIL",
        severity: adheres ? "INFO" : "BLOCKER",
        message: adheres
          ? `Policy '${policy.name}' conforms to ${patterns.policies.baseClass} and Scope pattern.`
          : `Policy '${policy.name}' does not implement standard Scope or base class.`
      });
    }

    // 3. Validate Controller Pattern
    for (const ctrl of slicePlan.controllers) {
      const hasAuthBeforeAction = ctrl.codePreview.includes(`before_action :${patterns.controllers.authMethod}`);
      checks.push({
        id: `PAT-003-CTRL-${ctrl.name}`,
        name: `Controller Authentication Pattern: ${ctrl.name}`,
        category: "PATTERN_CONFORMANCE",
        status: "STATIC",
        verdict: hasAuthBeforeAction ? "PASS" : "FAIL",
        severity: hasAuthBeforeAction ? "INFO" : "BLOCKER",
        message: hasAuthBeforeAction
          ? `Controller '${ctrl.name}' implements '${patterns.controllers.authMethod}'.`
          : `Controller '${ctrl.name}' missing '${patterns.controllers.authMethod}' before_action.`
      });
    }

    // 4. Validate Model Tenancy Association Pattern
    for (const model of slicePlan.models) {
      if (model.belongsToTenancy) {
        const hasTenancy = model.codePreview.includes(model.belongsToTenancy);
        checks.push({
          id: `PAT-004-MODEL-${model.name}`,
          name: `Model Tenancy Scoping: ${model.name}`,
          category: "PATTERN_CONFORMANCE",
          status: "STATIC",
          verdict: hasTenancy ? "PASS" : "FAIL",
          severity: hasTenancy ? "INFO" : "BLOCKER",
          message: hasTenancy
            ? `Model '${model.name}' implements tenancy association '${model.belongsToTenancy}'.`
            : `Model '${model.name}' missing tenancy association.`
        });
      }
    }

    return checks;
  }
}
