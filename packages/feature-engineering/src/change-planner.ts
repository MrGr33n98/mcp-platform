import type {
  ChangeOperation,
  ChangePlan,
  ChangePlanRollbackStep,
  ChangePlanVerificationStep,
  VerticalSlicePlan
} from "./types.js";

export class ChangePlanner {
  public static planChanges(slicePlan: VerticalSlicePlan, productName = "oest"): ChangePlan {
    const operations: ChangeOperation[] = [];

    // 1. Database Migration
    if (slicePlan.migrationPlan) {
      operations.push({
        id: `OP-001-MIGRATION`,
        type: "RUN_MIGRATION",
        path: slicePlan.migrationPlan.targetPath,
        description: `Create database tables for ${slicePlan.title} (${slicePlan.databaseChanges.map((c) => c.table).join(", ")})`,
        patternApplied: `Rails Migration [${slicePlan.existingPatterns.migrations.railsVersion}]`,
        codePreview: slicePlan.migrationPlan.rubyCode
      });
    }

    let opIdx = 2;

    // 2. Models
    for (const model of slicePlan.models) {
      operations.push({
        id: `OP-${String(opIdx++).padStart(3, "0")}-MODEL`,
        type: "CREATE_FILE",
        path: model.filePath,
        description: `Create domain model ${model.name} with tenancy association (${model.belongsToTenancy})`,
        patternApplied: `ApplicationRecord with ${model.belongsToTenancy}`,
        codePreview: model.codePreview
      });
    }

    // 3. Policies
    for (const policy of slicePlan.policies) {
      operations.push({
        id: `OP-${String(opIdx++).padStart(3, "0")}-POLICY`,
        type: "CREATE_FILE",
        path: policy.filePath,
        description: `Create Pundit authorization policy ${policy.name} enforcing strict tenant boundary`,
        patternApplied: `${slicePlan.existingPatterns.policies.baseClass} with Scope isolation`,
        codePreview: policy.codePreview
      });
    }

    // 4. Services
    for (const service of slicePlan.services) {
      operations.push({
        id: `OP-${String(opIdx++).padStart(3, "0")}-SERVICE`,
        type: "CREATE_FILE",
        path: service.filePath,
        description: `Create service ${service.name}: ${service.responsibility}`,
        patternApplied: slicePlan.existingPatterns.services.patternType,
        codePreview: service.codePreview
      });
    }

    // 5. Jobs
    for (const job of slicePlan.jobs) {
      operations.push({
        id: `OP-${String(opIdx++).padStart(3, "0")}-JOB`,
        type: "CREATE_FILE",
        path: job.filePath,
        description: `Create background worker ${job.name} on queue '${job.queue}' with timeout ${job.timeoutSeconds}s`,
        patternApplied: `${slicePlan.existingPatterns.jobs.baseClass} with retry policy`,
        codePreview: job.codePreview
      });
    }

    // 6. Controllers
    for (const ctrl of slicePlan.controllers) {
      operations.push({
        id: `OP-${String(opIdx++).padStart(3, "0")}-CONTROLLER`,
        type: "CREATE_FILE",
        path: ctrl.filePath,
        description: `Create API controller ${ctrl.name} with ${slicePlan.existingPatterns.controllers.authMethod}`,
        patternApplied: ctrl.baseClass,
        codePreview: ctrl.codePreview
      });
    }

    // 7. Routes
    operations.push({
      id: `OP-${String(opIdx++).padStart(3, "0")}-ROUTES`,
      type: "REGISTER_ROUTE",
      path: "config/routes.rb",
      description: `Register RESTful API routes under /api/v1/developer/webhooks`,
      patternApplied: "Rails REST Routing",
      codePreview: slicePlan.routes.map((r) => r.routeCodeSnippet).join("\n")
    });

    // 8. ActiveAdmin
    for (const admin of slicePlan.activeAdmin) {
      operations.push({
        id: `OP-${String(opIdx++).padStart(3, "0")}-ADMIN`,
        type: "ADD_ACTIVE_ADMIN",
        path: admin.filePath,
        description: `Register ActiveAdmin resource ${admin.resourceName}`,
        patternApplied: "ActiveAdmin Resource DSL",
        codePreview: admin.codePreview
      });
    }

    // 9. Tests
    for (const test of slicePlan.tests) {
      operations.push({
        id: `OP-${String(opIdx++).padStart(3, "0")}-TEST`,
        type: "CREATE_FILE",
        path: test.filePath,
        description: `Create ${test.category} test suite: ${test.description}`,
        patternApplied: `RSpec ${test.category}`,
        codePreview: test.codePreview
      });
    }

    // Verification steps
    const verification: ChangePlanVerificationStep[] = slicePlan.verificationPlan.checks.map((c, i) => ({
      step: i + 1,
      name: c.name,
      command: c.command,
      expected: c.expectedOutput
    }));

    // Rollback steps
    const rollback: ChangePlanRollbackStep[] = slicePlan.rollbackPlan.steps.map((s) => ({
      step: s.stepNumber,
      name: s.name,
      action: s.command || s.rubyCode || s.description
    }));

    return {
      schema_version: 1,
      mode: "PLAN_ONLY",
      product: productName,
      capability: slicePlan.capability,
      operations,
      verification,
      rollback,
      approval_required: true
    };
  }
}
