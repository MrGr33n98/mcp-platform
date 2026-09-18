import type { ColumnDefinition, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { MigrationSafety, VerificationCheckResult } from "../types.js";

export class MigrationValidator {
  public static validate(slicePlan: VerticalSlicePlan): {
    checks: VerificationCheckResult[];
    safety: MigrationSafety;
  } {
    const checks: VerificationCheckResult[] = [];
    const migration = slicePlan.migrationPlan;
    let safety: MigrationSafety = "SAFE";

    if (!migration || slicePlan.databaseChanges.length === 0) {
      checks.push({
        id: "MIG-001-NO-MIGRATION",
        name: "Database Migration Requirement",
        category: "DATABASE_MIGRATION",
        status: "STATIC",
        verdict: "PASS",
        severity: "INFO",
        message: "No database migrations required for this plan."
      });
      return { checks, safety: "SAFE" };
    }

    // 1. Reversibility Check
    const isReversible = migration.reversible && (migration.rubyCode.includes("def change") || (migration.rubyCode.includes("def up") && migration.rubyCode.includes("def down")));
    checks.push({
      id: "MIG-002-REVERSIBILITY",
      name: "Migration Reversibility Verification",
      category: "DATABASE_MIGRATION",
      status: "STATIC",
      verdict: isReversible ? "PASS" : "FAIL",
      severity: isReversible ? "INFO" : "BLOCKER",
      message: isReversible
        ? `Migration '${migration.migrationName}' is fully reversible with standard Rails rollback.`
        : `Migration '${migration.migrationName}' lacks reversible change/down definition.`
    });
    if (!isReversible) safety = "UNSAFE";

    // 2. Tenant Scoping & Indexing on Created Tables
    const tenantKey = slicePlan.existingPatterns.models.tenantKey;
    for (const change of slicePlan.databaseChanges) {
      if (change.operation === "CREATE_TABLE") {
        const hasTenantKey = change.columns.some((c: ColumnDefinition) => c.name === tenantKey);
        const hasParentFk = change.foreignKeys.length > 0;

        // Either has tenantKey or parent foreign key (e.g. webhook_deliveries belongs_to webhook_endpoint)
        const isTenancySafeguarded = hasTenantKey || hasParentFk;
        checks.push({
          id: `MIG-003-TENANT-KEY-${change.table}`,
          name: `Tenancy Key & Isolation Constraints: ${change.table}`,
          category: "DATABASE_MIGRATION",
          status: "STATIC",
          verdict: isTenancySafeguarded ? "PASS" : "FAIL",
          severity: isTenancySafeguarded ? "INFO" : "BLOCKER",
          message: isTenancySafeguarded
            ? `Table '${change.table}' has explicit tenant key '${tenantKey}' or cascading parent foreign key.`
            : `Table '${change.table}' lacks tenant isolation key '${tenantKey}'.`
        });
        if (!isTenancySafeguarded) safety = "UNSAFE";

        // Check for indexed foreign keys
        const hasIndexes = change.indexes.length > 0;
        checks.push({
          id: `MIG-004-INDEXES-${change.table}`,
          name: `Index Coverage: ${change.table}`,
          category: "DATABASE_MIGRATION",
          status: "STATIC",
          verdict: hasIndexes ? "PASS" : "WARNING",
          severity: hasIndexes ? "INFO" : "WARNING",
          message: hasIndexes
            ? `Table '${change.table}' defines ${change.indexes.length} indexes for query performance.`
            : `Table '${change.table}' has no indexes specified.`
        });
      }
    }

    return { checks, safety };
  }
}
