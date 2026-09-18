import { createHash } from "node:crypto";
import type { ChangePlan } from "@mcp-platform/feature-engineering";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import { VerificationReportBuilder } from "@mcp-platform/verification-engine";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { GitReceipt } from "@mcp-platform/git-governance";
import type {
  CIReceipt,
  DeploymentPlan,
  EnvironmentType,
  ReleaseArtifact,
  ReleaseCandidate,
  ReleaseRiskLevel
} from "../types.js";
import { ProvenanceChainValidator } from "./provenance-validator.js";
import { ArtifactValidator } from "./artifact-validator.js";

export class ReleaseCandidateBuilder {
  public static build(params: {
    product: string;
    environment: EnvironmentType;
    changePlan: ChangePlan;
    verificationReceipt: VerificationReceipt;
    applyReceipt: ApplyReceipt;
    gitReceipt: GitReceipt;
    ciReceipt: CIReceipt;
    artifact: ReleaseArtifact;
    deploymentPlan?: DeploymentPlan | undefined;
  }): { candidate?: ReleaseCandidate | undefined; errors: string[] } {
    const {
      product,
      environment,
      changePlan,
      verificationReceipt,
      applyReceipt,
      gitReceipt,
      ciReceipt,
      artifact,
      deploymentPlan
    } = params;

    // 1. Validação de Proveniência
    const provenanceResult = ProvenanceChainValidator.validateChain(
      changePlan,
      verificationReceipt,
      applyReceipt,
      gitReceipt,
      ciReceipt,
      artifact
    );

    // 2. Validação do Artefato
    const artifactResult = ArtifactValidator.validate(artifact);

    const errors = [...provenanceResult.errors, ...artifactResult.errors];
    if (errors.length > 0) {
      return { errors };
    }

    const computedPlanDigest = VerificationReportBuilder.calculatePlanDigest(changePlan);

    // 3. Avaliação de Risco
    let riskLevel: ReleaseRiskLevel = "LOW";
    if (environment === "PRODUCTION") {
      riskLevel = "MEDIUM";
    }

    // 4. Default Deployment Plan
    const finalPlan: DeploymentPlan = deploymentPlan ?? {
      plan_id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      target: {
        product,
        environment,
        service: "web"
      },
      artifact: {
        digest: artifact.digest,
        immutable_tag: artifact.immutable_tag
      },
      strategy: environment === "PRODUCTION" || environment === "CANARY" ? "CANARY" : "REPLACE",
      steps: [
        {
          step_id: "step_preflight",
          name: "Verify Target & Snapshot Diagnostics",
          action_type: "PREFLIGHT",
          timeout_ms: 30000
        },
        {
          step_id: "step_deploy",
          name: "Apply Artifact Mutation",
          action_type: "DEPLOY",
          timeout_ms: 120000
        },
        {
          step_id: "step_verify",
          name: "Verify Production Invariants",
          action_type: "VERIFY",
          timeout_ms: 60000
        }
      ],
      preconditions: [
        "CI_PASS",
        "PROVENANCE_VERIFIED",
        "HEALTHY_BASELINE_DIAGNOSTICS"
      ],
      health_checks: [
        "HTTP_200_HEALTH_ENDPOINT",
        "DATABASE_CONNECTIVITY",
        "ERROR_RATE_BELOW_THRESHOLD"
      ],
      promotion_criteria: [
        {
          metric: "http_5xx_rate",
          operator: "<=",
          threshold: 0.01,
          window_seconds: 60
        },
        {
          metric: "p95_latency_ms",
          operator: "<=",
          threshold: 1000,
          window_seconds: 60
        }
      ],
      rollback_criteria: [
        {
          metric: "http_5xx_rate",
          operator: ">=",
          threshold: 0.05
        }
      ],
      timeout_ms: 300000
    };

    const candidateId = `rc_${product}_${gitReceipt.commit_sha.slice(0, 8)}_${createHash("sha256")
      .update(artifact.digest + computedPlanDigest)
      .digest("hex")
      .slice(0, 8)}`;

    const candidate: ReleaseCandidate = {
      release_candidate_id: candidateId,
      product,
      environment,
      commit_sha: gitReceipt.commit_sha,
      artifact,
      git_receipt: gitReceipt,
      ci_receipt: ciReceipt,
      change_plan_digest: computedPlanDigest,
      verification_digest: verificationReceipt.verification_id,
      risk_level: riskLevel,
      deployment_plan: finalPlan
    };

    return { candidate, errors: [] };
  }
}
