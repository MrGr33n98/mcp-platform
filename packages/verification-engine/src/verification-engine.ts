import type { VerificationReceipt, VerificationReport, VerificationRequest } from "./types.js";
import { WorkspaceVerifier } from "./runners/workspace-verifier.js";
import { RailsVerifier } from "./runners/rails-verifier.js";
import { NextVerifier } from "./runners/next-verifier.js";
import { DockerVerifier } from "./runners/docker-verifier.js";
import { EvidenceValidator } from "./validators/evidence-validator.js";
import { PatternValidator } from "./validators/pattern-validator.js";
import { DependencyValidator } from "./validators/dependency-validator.js";
import { OperationValidator } from "./validators/operation-validator.js";
import { ArchitectureValidator } from "./validators/architecture-validator.js";
import { MigrationValidator } from "./validators/migration-validator.js";
import { PolicyValidator } from "./validators/policy-validator.js";
import { APIContractValidator } from "./validators/api-contract-validator.js";
import { TestPlanValidator } from "./validators/test-plan-validator.js";
import { SecurityValidator } from "./validators/security-validator.js";
import { RollbackValidator } from "./validators/rollback-validator.js";
import { ChangeSurfaceAnalyzer } from "./reports/change-surface.js";
import { BlastRadiusAnalyzer } from "./reports/blast-radius.js";
import { VerificationReportBuilder } from "./reports/verification-report.js";
import { MarkdownReporter } from "./reports/markdown-reporter.js";

export interface VerificationResult {
  report: VerificationReport;
  receipt: VerificationReceipt;
  markdown: string;
}

export class VerificationEngine {
  public static async verify(request: VerificationRequest): Promise<VerificationResult> {
    const workspaceRoot =
      request.workspace?.rootPath || request.repositoryManifest.repository.path || process.cwd();

    // 1. Capture and bind repository revision
    const repositoryRevision =
      request.options?.customRevision || WorkspaceVerifier.captureRevision(workspaceRoot);

    const mode = request.options?.mode || "STATIC_VERIFY";

    // 2. Run All Specialized Validators
    const evidenceChecks = EvidenceValidator.validate(
      request.repositoryManifest,
      request.architectureGraph,
      request.changePlan,
      request.verticalSlicePlan
    );

    const patternChecks = PatternValidator.validate(
      request.changePlan,
      request.verticalSlicePlan
    );

    const dependencyChecks = DependencyValidator.validate(request.changePlan);
    const operationChecks = OperationValidator.validate(request.changePlan);
    const archChecks = ArchitectureValidator.validate(request.architectureGraph, request.verticalSlicePlan);
    const { checks: migrationChecks } = MigrationValidator.validate(request.verticalSlicePlan);
    const policyChecks = PolicyValidator.validate(request.verticalSlicePlan);
    const apiChecks = APIContractValidator.validate(request.verticalSlicePlan);
    const testPlanChecks = TestPlanValidator.validate(request.verticalSlicePlan);
    const { checks: securityChecks, securityFindings } = SecurityValidator.validate(request.verticalSlicePlan);
    const rollbackChecks = RollbackValidator.validate(request.verticalSlicePlan);

    // 3. Profile-Specific Static Checks
    const railsChecks = RailsVerifier.verifyStatic(request.repositoryManifest);
    const nextChecks = NextVerifier.verifyStatic(request.repositoryManifest);
    const dockerChecks = DockerVerifier.verifyStatic(request.repositoryManifest);

    const allChecks = [
      ...evidenceChecks,
      ...patternChecks,
      ...dependencyChecks,
      ...operationChecks,
      ...archChecks,
      ...migrationChecks,
      ...policyChecks,
      ...apiChecks,
      ...testPlanChecks,
      ...securityChecks,
      ...rollbackChecks,
      ...railsChecks,
      ...nextChecks,
      ...dockerChecks
    ];

    // 4. Compute Change Surface & Blast Radius
    const changeSurface = ChangeSurfaceAnalyzer.analyze(request.changePlan);
    const blastRadius = BlastRadiusAnalyzer.analyze(request.architectureGraph, request.verticalSlicePlan);

    // 5. Build Report & Cryptographic Receipt
    const { report, receipt } = VerificationReportBuilder.build({
      target: {
        product: request.changePlan.product,
        capability: request.changePlan.capability
      },
      changePlan: request.changePlan,
      repositoryRevision,
      mode,
      checks: allChecks,
      securityFindings,
      changeSurface,
      blastRadius
    });

    // 6. Generate Markdown
    const markdown = MarkdownReporter.generate(report, receipt);

    return {
      report,
      receipt,
      markdown
    };
  }
}
