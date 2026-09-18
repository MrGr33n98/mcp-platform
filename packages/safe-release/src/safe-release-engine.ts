import { createHash } from "node:crypto";
import type {
  AuditEventType,
  ReleaseAuditEvent,
  ReleaseCandidate,
  ReleaseReceipt,
  ReleaseState,
  RollbackReceipt,
  SafeReleaseRequest,
  SafeReleaseResult
} from "./types.js";
import { ReleaseCandidateBuilder } from "./candidate/release-candidate-builder.js";
import { CIPolicy } from "./ci/ci-policy.js";
import { ReleaseApprovalValidator } from "./approvals/release-approval-validator.js";
import { EnvironmentRegistry } from "./security/environment-policy.js";
import { DeploymentPolicy } from "./security/deployment-policy.js";
import { CredentialIsolationPolicy } from "./security/credential-policy.js";
import { DeploymentStateMachine } from "./deployment/deployment-state-machine.js";
import { DeploymentReconciler, ReleaseLock } from "./deployment/deployment-controller.js";
import { CanaryController } from "./canary/canary-controller.js";
import { DiagnosticsAdapter } from "./verification/diagnostics-adapter.js";
import { ProductionVerifier } from "./verification/production-verifier.js";
import { InvariantVerifier } from "./verification/invariant-verifier.js";
import { RollbackController } from "./rollback/rollback-controller.js";
import { ReleaseReportGenerator } from "./reports/release-report.js";

export class SafeReleaseEngine {
  public static async executeRelease(request: SafeReleaseRequest): Promise<SafeReleaseResult> {
    const auditEvents: ReleaseAuditEvent[] = [];
    let sequence = 1;

    const addEvent = (eventType: AuditEventType, detail: string, error?: string) => {
      auditEvents.push({
        sequence: sequence++,
        event_type: eventType,
        release_id: request.gitReceipt.commit_sha.slice(0, 8),
        timestamp: new Date().toISOString(),
        detail,
        error
      });
    };

    const stateMachine = new DeploymentStateMachine("CREATED");
    addEvent("RELEASE_CREATED", `Initiated safe release pipeline for ${request.product} in ${request.environment}.`);

    // 1. Provenance & Candidate Builder
    const candidateResult = ReleaseCandidateBuilder.build({
      product: request.product,
      environment: request.environment,
      changePlan: request.changePlan,
      verificationReceipt: request.verificationReceipt,
      applyReceipt: request.applyReceipt,
      gitReceipt: request.gitReceipt,
      ciReceipt: request.ciReceipt,
      artifact: request.artifact
    });

    if (!candidateResult.candidate || candidateResult.errors.length > 0) {
      addEvent("RELEASE_FAILED", "Candidate provenance/artifact validation failed.", candidateResult.errors.join("; "));
      return {
        release_candidate_id: "unresolved",
        final_state: "CI_FAILED",
        audit_events: auditEvents,
        markdown: `# Safe Release Blocked\n\n${candidateResult.errors.map((e) => `- ${e}`).join("\n")}`
      };
    }

    const candidate = candidateResult.candidate;

    // 2. CI Policy Check
    const ciEval = CIPolicy.evaluate(request.ciReceipt);
    if (!ciEval.allowed) {
      stateMachine.transitionTo("CI_FAILED", ciEval.violations.join("; "));
      addEvent("RELEASE_FAILED", "CI Policy rejected release candidate.", ciEval.violations.join("; "));
      return {
        release_candidate_id: candidate.release_candidate_id,
        final_state: stateMachine.getCurrentState(),
        audit_events: auditEvents,
        markdown: ReleaseReportGenerator.generateMarkdown({
          candidate,
          finalState: stateMachine.getCurrentState(),
          auditEvents,
          errors: ciEval.violations
        })
      };
    }

    stateMachine.transitionTo("CI_VERIFIED");
    addEvent("CI_VERIFIED", `CI run ${request.ciReceipt.ci_run_id} verified with all mandatory checks passing.`);

    // 3. Environment & Security Checks
    const envDef = EnvironmentRegistry.get(request.environment);
    const planSafety = DeploymentPolicy.validatePlanSafety(
      candidate.deployment_plan,
      request.deploymentProvider,
      request.environment
    );

    if (!planSafety.valid) {
      stateMachine.transitionTo("APPROVAL_PENDING");
      stateMachine.transitionTo("PROMOTION_BLOCKED", planSafety.errors.join("; "));
      addEvent("RELEASE_FAILED", "Deployment plan safety violations.", planSafety.errors.join("; "));
      return {
        release_candidate_id: candidate.release_candidate_id,
        final_state: stateMachine.getCurrentState(),
        audit_events: auditEvents,
        markdown: ReleaseReportGenerator.generateMarkdown({
          candidate,
          finalState: stateMachine.getCurrentState(),
          auditEvents,
          errors: planSafety.errors
        })
      };
    }

    // Asserção contra credenciais expostas
    CredentialIsolationPolicy.assertNoCredentialsInPayload(candidate);

    // 4. Initial Approval Check
    stateMachine.transitionTo("APPROVAL_PENDING");
    const requiredAction = candidate.deployment_plan.strategy === "CANARY" ? "DEPLOY_CANARY" : (
      request.environment === "STAGING" ? "DEPLOY_STAGING" : "PROMOTE_PRODUCTION"
    );

    const approvalEval = ReleaseApprovalValidator.validate({
      approval: request.approvalReceipt,
      candidate,
      expectedEnvironment: request.environment,
      requiredAction
    });

    if (!approvalEval.valid) {
      stateMachine.transitionTo("PROMOTION_BLOCKED", approvalEval.errors.join("; "));
      addEvent("RELEASE_FAILED", "Initial approval rejected.", approvalEval.errors.join("; "));
      return {
        release_candidate_id: candidate.release_candidate_id,
        final_state: stateMachine.getCurrentState(),
        audit_events: auditEvents,
        markdown: ReleaseReportGenerator.generateMarkdown({
          candidate,
          finalState: stateMachine.getCurrentState(),
          auditEvents,
          errors: approvalEval.errors
        })
      };
    }

    ReleaseApprovalValidator.consumeNonce(request.approvalReceipt.nonce);
    stateMachine.transitionTo("APPROVED");
    addEvent("APPROVAL_GRANTED", `Approval ${request.approvalReceipt.approval_id} validated for action ${requiredAction}.`);

    // 5. Release Lock Acquisition
    const lockAcquired = ReleaseLock.acquire(request.product, request.environment, candidate.release_candidate_id);
    if (!lockAcquired) {
      stateMachine.transitionTo("PROMOTION_BLOCKED", "Concurrent release mutation lock active.");
      addEvent("RELEASE_FAILED", `Environment ${request.environment} is currently locked by another release mutation.`);
      return {
        release_candidate_id: candidate.release_candidate_id,
        final_state: stateMachine.getCurrentState(),
        audit_events: auditEvents,
        markdown: ReleaseReportGenerator.generateMarkdown({
          candidate,
          finalState: stateMachine.getCurrentState(),
          auditEvents,
          errors: [`CONCURRENT_RELEASE_LOCK_ACTIVE: Environment ${request.environment} is locked.`]
        })
      };
    }

    let releaseReceipt: ReleaseReceipt | undefined;
    let rollbackReceipt: RollbackReceipt | undefined;
    const errors: string[] = [];

    try {
      // 6. Pre-Deployment Diagnostic Snapshot & Preparation
      const preSnapshot = DiagnosticsAdapter.createSnapshot({
        environment: request.environment,
        deploymentRevision: candidate.commit_sha
      });

      stateMachine.transitionTo("PREPARING");
      addEvent("DEPLOY_STARTED", `Preparing deployment target with snapshot ${preSnapshot.snapshot_id}.`);

      const prepResult = await request.deploymentProvider.prepare(candidate.deployment_plan);
      if (!prepResult.ready) {
        stateMachine.transitionTo("DEPLOY_FAILED", prepResult.error ?? "Preparation failed");
        addEvent("RELEASE_FAILED", "Provider preparation failed.", prepResult.error);
        return {
          release_candidate_id: candidate.release_candidate_id,
          final_state: stateMachine.getCurrentState(),
          audit_events: auditEvents,
          markdown: ReleaseReportGenerator.generateMarkdown({
            candidate,
            finalState: stateMachine.getCurrentState(),
            auditEvents,
            errors: [prepResult.error ?? "Provider preparation failed."]
          })
        };
      }

      // 7. Execution: Canary vs Direct
      let deployedDeploymentId = `dep_init_${Date.now()}`;

      if (candidate.deployment_plan.strategy === "CANARY") {
        stateMachine.transitionTo("CANARY_DEPLOYING");
        addEvent("CANARY_STARTED", "Dispatched canary slice mutation.");

        if (request.options?.simulateCrashDuringCanary) {
          // Simula crash e reconciliação
          const reconciler = await DeploymentReconciler.reconcile(
            request.deploymentProvider,
            deployedDeploymentId,
            stateMachine
          );
          addEvent("CANARY_HEALTH_CHECK", `Process recovered after crash. Reconciled state: ${reconciler.reconciledState}.`);
        }

        const canaryController = new CanaryController(request.deploymentProvider, request.customCanaryPolicy);
        const canaryExecution = await canaryController.executeCanary({
          plan: candidate.deployment_plan,
          rawTelemetry: request.rawCanaryTelemetry
        });

        deployedDeploymentId = canaryExecution.deployment_id;

        if (stateMachine.canTransitionTo("CANARY_OBSERVING")) {
          stateMachine.transitionTo("CANARY_OBSERVING");
        }
        addEvent("CANARY_HEALTH_CHECK", `Canary evaluated: status ${canaryExecution.health.status}.`);

        if (!canaryExecution.promotion.can_promote) {
          errors.push(...canaryExecution.promotion.reasons);
          stateMachine.transitionTo("CANARY_FAILED", canaryExecution.promotion.reasons.join("; "));
          addEvent("RELEASE_FAILED", "Canary failed promotion criteria.", canaryExecution.promotion.reasons.join("; "));

          // Rollback se configurado
          if (request.options?.autoRollbackOnFailure && request.knownGoodRelease) {
            stateMachine.transitionTo("ROLLBACK_REQUIRED");
            stateMachine.transitionTo("ROLLING_BACK");
            addEvent("ROLLBACK_STARTED", `Triggering rollback to known good release ${request.knownGoodRelease.release_id}.`);

            const rollbackResult = await RollbackController.executeRollback({
              failedReleaseId: candidate.release_candidate_id,
              targetRelease: request.knownGoodRelease,
              reason: "Canary failure health threshold violated.",
              provider: request.deploymentProvider,
              diagnosticsBeforeDigest: preSnapshot.digest
            });

            rollbackReceipt = rollbackResult.receipt;
            if (rollbackResult.errors.length === 0) {
              stateMachine.transitionTo("ROLLED_BACK");
              addEvent("ROLLBACK_COMPLETED", `Rollback verified for ${request.knownGoodRelease.release_id}.`);
            } else {
              stateMachine.transitionTo("ROLLBACK_FAILED");
              addEvent("RELEASE_FAILED", "Rollback failed verification.", rollbackResult.errors.join("; "));
            }
          }

          return {
            release_candidate_id: candidate.release_candidate_id,
            final_state: stateMachine.getCurrentState(),
            rollback_receipt: rollbackReceipt,
            audit_events: auditEvents,
            markdown: ReleaseReportGenerator.generateMarkdown({
              candidate,
              finalState: stateMachine.getCurrentState(),
              auditEvents,
              errors
            })
          };
        }

        stateMachine.transitionTo("CANARY_HEALTHY");
        stateMachine.transitionTo("PROMOTION_PENDING");

        // Promoção explícita se requerido
        if (envDef.is_production) {
          if (!request.promotionApprovalReceipt) {
            stateMachine.transitionTo("PROMOTION_BLOCKED", "Missing PROMOTE_PRODUCTION approval receipt.");
            addEvent("RELEASE_FAILED", "Production promotion blocked: explicit promotion approval receipt missing.");
            return {
              release_candidate_id: candidate.release_candidate_id,
              final_state: stateMachine.getCurrentState(),
              audit_events: auditEvents,
              markdown: ReleaseReportGenerator.generateMarkdown({
                candidate,
                finalState: stateMachine.getCurrentState(),
                auditEvents,
                errors: ["MISSING_PROMOTION_APPROVAL: Promoting canary to production requires explicit PROMOTE_PRODUCTION approval."]
              })
            };
          }

          const promoApprovalEval = ReleaseApprovalValidator.validate({
            approval: request.promotionApprovalReceipt,
            candidate,
            expectedEnvironment: request.environment,
            requiredAction: "PROMOTE_PRODUCTION"
          });

          if (!promoApprovalEval.valid) {
            stateMachine.transitionTo("PROMOTION_BLOCKED", promoApprovalEval.errors.join("; "));
            addEvent("RELEASE_FAILED", "Production promotion approval rejected.", promoApprovalEval.errors.join("; "));
            return {
              release_candidate_id: candidate.release_candidate_id,
              final_state: stateMachine.getCurrentState(),
              audit_events: auditEvents,
              markdown: ReleaseReportGenerator.generateMarkdown({
                candidate,
                finalState: stateMachine.getCurrentState(),
                auditEvents,
                errors: promoApprovalEval.errors
              })
            };
          }

          ReleaseApprovalValidator.consumeNonce(request.promotionApprovalReceipt.nonce);
          addEvent("PROMOTION_APPROVED", `Promotion approval ${request.promotionApprovalReceipt.approval_id} validated.`);
        }

        stateMachine.transitionTo("PROMOTING");
        const fullDeployResult = await request.deploymentProvider.deploy(candidate.deployment_plan, "FULL");
        if (fullDeployResult.status !== "SUCCESS") {
          stateMachine.transitionTo("DEPLOY_FAILED", fullDeployResult.message);
          addEvent("RELEASE_FAILED", "Full promotion deployment failed.", fullDeployResult.message);
          return {
            release_candidate_id: candidate.release_candidate_id,
            final_state: stateMachine.getCurrentState(),
            audit_events: auditEvents,
            markdown: ReleaseReportGenerator.generateMarkdown({
              candidate,
              finalState: stateMachine.getCurrentState(),
              auditEvents,
              errors: [fullDeployResult.message ?? "Full promotion failed."]
            })
          };
        }

        stateMachine.transitionTo("PRODUCTION_DEPLOYED");
        addEvent("PRODUCTION_DEPLOYED", `Full production deployment applied with artifact ${candidate.artifact.digest}.`);
      } else {
        // Non-canary direct deploy
        const deployResult = await request.deploymentProvider.deploy(candidate.deployment_plan, "FULL");
        if (deployResult.status !== "SUCCESS") {
          stateMachine.transitionTo("DEPLOY_FAILED", deployResult.message);
          addEvent("RELEASE_FAILED", "Deployment failed.", deployResult.message);
          return {
            release_candidate_id: candidate.release_candidate_id,
            final_state: stateMachine.getCurrentState(),
            audit_events: auditEvents,
            markdown: ReleaseReportGenerator.generateMarkdown({
              candidate,
              finalState: stateMachine.getCurrentState(),
              auditEvents,
              errors: [deployResult.message ?? "Direct deployment failed."]
            })
          };
        }
        deployedDeploymentId = deployResult.deployment_id;
        stateMachine.transitionTo("PRODUCTION_DEPLOYED");
        addEvent("PRODUCTION_DEPLOYED", `Deployed artifact ${candidate.artifact.digest}.`);
      }

      // 8. Production Verification
      stateMachine.transitionTo("PRODUCTION_VERIFYING");
      const prodVerifyResult = await ProductionVerifier.verify({
        candidate,
        provider: request.deploymentProvider,
        rawTelemetry: request.rawProductionTelemetry
      });

      const invariantEval = InvariantVerifier.verifyReleaseInvariants(candidate, prodVerifyResult);
      if (!invariantEval.passed) {
        stateMachine.transitionTo("PRODUCTION_UNHEALTHY", invariantEval.violations.join("; "));
        addEvent("RELEASE_FAILED", "Production verification invariant violation.", invariantEval.violations.join("; "));
        return {
          release_candidate_id: candidate.release_candidate_id,
          final_state: stateMachine.getCurrentState(),
          audit_events: auditEvents,
          markdown: ReleaseReportGenerator.generateMarkdown({
            candidate,
            finalState: stateMachine.getCurrentState(),
            auditEvents,
            errors: invariantEval.violations
          })
        };
      }

      stateMachine.transitionTo("PRODUCTION_VERIFIED");
      addEvent("PRODUCTION_VERIFIED", "Production verification completed successfully with 100% invariant satisfaction.");

      // 9. Post-Deployment Snapshot & ReleaseReceipt
      const postSnapshot = DiagnosticsAdapter.createSnapshot({
        environment: request.environment,
        deploymentRevision: candidate.commit_sha
      });

      const deployedAt = new Date().toISOString();
      const releaseId = `rel_${request.product}_${candidate.commit_sha.slice(0, 8)}_${Date.now()}`;

      const receiptDigest = createHash("sha256")
        .update(
          JSON.stringify({
            releaseId,
            product: request.product,
            environment: request.environment,
            artifactDigest: candidate.artifact.digest,
            commitSha: candidate.commit_sha,
            deployedAt,
            preSnapshotDigest: preSnapshot.digest,
            postSnapshotDigest: postSnapshot.digest
          })
        )
        .digest("hex");

      releaseReceipt = {
        schema_version: 1,
        receipt_type: "RELEASE_RECEIPT",
        release_id: releaseId,
        product: request.product,
        environment: request.environment,
        artifact_digest: candidate.artifact.digest,
        commit_sha: candidate.commit_sha,
        deployment_id: deployedDeploymentId,
        change_plan_digest: candidate.change_plan_digest,
        verification_digest: candidate.verification_digest,
        apply_id: candidate.git_receipt.apply_id,
        git_operation_id: candidate.git_receipt.git_operation_id,
        ci_run_id: candidate.ci_receipt.ci_run_id,
        approval_id: request.approvalReceipt.approval_id,
        deployed_at: deployedAt,
        verification_status: "PRODUCTION_VERIFIED",
        diagnostic_snapshot_before: preSnapshot.digest,
        diagnostic_snapshot_after: postSnapshot.digest,
        receipt_digest: `sha256:${receiptDigest}`
      };

      return {
        release_candidate_id: candidate.release_candidate_id,
        final_state: stateMachine.getCurrentState(),
        release_receipt: releaseReceipt,
        audit_events: auditEvents,
        markdown: ReleaseReportGenerator.generateMarkdown({
          candidate,
          finalState: stateMachine.getCurrentState(),
          receipt: releaseReceipt,
          auditEvents
        })
      };
    } finally {
      ReleaseLock.release(request.product, request.environment, candidate.release_candidate_id);
    }
  }
}
