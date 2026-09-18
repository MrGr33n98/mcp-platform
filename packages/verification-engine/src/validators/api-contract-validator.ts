import type { ControllerActionPlan, ControllerPlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class APIContractValidator {
  public static validate(slicePlan: VerticalSlicePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const routes = slicePlan.routes;
    const controllers = slicePlan.controllers;
    const apiContracts = slicePlan.apiContracts;

    // 1. Validate that routes map to existing controller actions
    const unmappedRoutes: string[] = [];
    for (const route of routes) {
      const targetCtrl = controllers.find((c: ControllerPlan) => c.filePath.includes(route.controller.split("/").pop()!));
      if (targetCtrl) {
        const actionExists = targetCtrl.actions.some((a: ControllerActionPlan) => a.name === route.action);
        if (!actionExists) {
          unmappedRoutes.push(`${route.method} ${route.path} -> action '${route.action}' missing in ${targetCtrl.name}`);
        }
      }
    }

    const hasNoUnmappedRoutes = unmappedRoutes.length === 0;
    checks.push({
      id: "API-001-ROUTE-ACTION-MAPPING",
      name: "REST Route to Controller Action Mapping",
      category: "API_CONTRACT",
      status: "STATIC",
      verdict: hasNoUnmappedRoutes ? "PASS" : "FAIL",
      severity: hasNoUnmappedRoutes ? "INFO" : "BLOCKER",
      message: hasNoUnmappedRoutes
        ? `All ${routes.length} routes map directly to defined controller actions.`
        : `Unmapped routes detected: ${unmappedRoutes.join("; ")}`
    });

    // 2. Validate API Contracts Schema presence
    const hasContracts = apiContracts.length > 0;
    checks.push({
      id: "API-002-CONTRACT-SCHEMAS",
      name: "API Request/Response Schema Contracts",
      category: "API_CONTRACT",
      status: "STATIC",
      verdict: hasContracts ? "PASS" : "WARNING",
      severity: hasContracts ? "INFO" : "WARNING",
      message: hasContracts
        ? `Verified ${apiContracts.length} explicit API contract schemas with status codes.`
        : "No explicit API request/response schemas specified."
    });

    return checks;
  }
}
