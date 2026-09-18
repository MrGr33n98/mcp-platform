import type { ChangePlan } from "@mcp-platform/feature-engineering";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import { VerificationReportBuilder } from "@mcp-platform/verification-engine";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { GitReceipt } from "@mcp-platform/git-governance";
import type { CIReceipt, ReleaseArtifact } from "../../src/types.js";

export function createValidTestChain(): {
  changePlan: ChangePlan;
  verificationReceipt: VerificationReceipt;
  applyReceipt: ApplyReceipt;
  gitReceipt: GitReceipt;
  ciReceipt: CIReceipt;
  artifact: ReleaseArtifact;
} {
  const commitSha = "a1b2c3d4e5f678901234567890abcdef12345678";
  const artifactDigest = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const verificationDigest = "sha256:vrf_digest_2222222222222222222222222222222222222222222222222222222222222222";
  const applyId = "app_apply_3333333333333333";

  const changePlan: ChangePlan = {
    schema_version: 1,
    mode: "PLAN_ONLY",
    product: "oest",
    capability: "CAP_01",
    operations: [
      {
        id: "op_001",
        type: "CREATE_FILE",
        path: "app/controllers/api/v1/health_controller.rb",
        description: "Create health check endpoint",
        patternApplied: "ControllerPattern"
      }
    ],
    verification: [
      {
        step: 1,
        name: "Run Specs",
        command: "bundle exec rspec",
        expected: "0 failures"
      }
    ],
    rollback: [
      {
        step: 1,
        name: "Remove File",
        action: "delete app/controllers/api/v1/health_controller.rb"
      }
    ],
    approval_required: true
  };

  const changePlanDigest = VerificationReportBuilder.calculatePlanDigest(changePlan);

  const verificationReceipt: VerificationReceipt = {
    schema_version: 1,
    receipt_type: "VERIFICATION_RECEIPT",
    verification_id: verificationDigest,
    change_plan_digest: changePlanDigest,
    repository_revision: {
      commitSha,
      branch: "main",
      isClean: true,
      workingDirectory: "C:/Users/Bobi/Desktop/drone/dronehub/backend"
    },
    verification_status: "PASS",
    verification_digest: "sha256:digest_vrf_proof",
    timestamp: new Date().toISOString()
  };

  const applyReceipt: ApplyReceipt = {
    schema_version: 1,
    receipt_type: "APPLY_RECEIPT",
    apply_id: applyId,
    change_plan_digest: changePlanDigest,
    verification_digest: verificationDigest,
    repository_before: {
      commitSha,
      branch: "main",
      isClean: true,
      workingDirectory: "C:/Users/Bobi/Desktop/drone/dronehub/backend"
    },
    applied_change_digest: "sha256:diff_digest_4444444444444444444444444444444444444444444444444444444444444444",
    status: "APPLIED_VERIFIED",
    approval_id: "appr_apply_001",
    timestamp: new Date().toISOString()
  };

  const gitReceipt: GitReceipt = {
    schema_version: 1,
    receipt_type: "GIT_RECEIPT",
    git_operation_id: "git_op_555555",
    repository: "MrGr33n98/oest-backend",
    source_revision: {
      commitSha,
      branch: "main",
      isClean: true,
      workingDirectory: "C:/Users/Bobi/Desktop/drone/dronehub/backend"
    },
    branch: "mcp/feature-health",
    commit_sha: commitSha,
    commit_diff_digest: "sha256:diff_digest_4444444444444444444444444444444444444444444444444444444444444444",
    change_plan_digest: changePlanDigest,
    verification_digest: verificationDigest,
    apply_id: applyId,
    push_status: "PUSHED",
    pr_status: "PR_CREATED",
    status: "COMMIT_VERIFIED",
    timestamp: new Date().toISOString()
  };

  const ciReceipt: CIReceipt = {
    schema_version: 1,
    ci_run_id: "ci_run_777777",
    provider: "github_actions",
    repository: "MrGr33n98/oest-backend",
    commit_sha: commitSha,
    workflow: "Build and Test",
    started_at: new Date(Date.now() - 60000).toISOString(),
    finished_at: new Date().toISOString(),
    status: "PASS",
    checks: [
      { name: "rspec", status: "PASS", mandatory: true },
      { name: "zeitwerk", status: "PASS", mandatory: true },
      { name: "typecheck", status: "PASS", mandatory: true },
      { name: "build", status: "PASS", mandatory: true }
    ],
    artifact_digests: [artifactDigest],
    provenance: {
      trigger_event: "push",
      branch: "main",
      actor: "mcp-governance"
    }
  };

  const artifact: ReleaseArtifact = {
    artifact_id: "art_oest_001",
    artifact_type: "DOCKER_IMAGE",
    immutable_tag: "v1.2.3-commit-a1b2c3d4",
    digest: artifactDigest,
    source_commit: commitSha,
    build_id: "build_888888"
  };

  return {
    changePlan,
    verificationReceipt,
    applyReceipt,
    gitReceipt,
    ciReceipt,
    artifact
  };
}
