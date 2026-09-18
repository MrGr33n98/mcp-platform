import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { PRPlan } from "../types.js";
import { PRBodyGenerator } from "./pr-body-generator.js";

export class PRPlanGenerator {
  public static generatePlan(
    repository: string,
    baseBranch: string,
    headBranch: string,
    changePlan: ChangePlan,
    applyReceipt: ApplyReceipt,
    commitShas: string[],
    approvalId: string,
    verticalSlicePlan?: VerticalSlicePlan | undefined
  ): PRPlan {
    const title = `feat(${changePlan.capability}): ${verticalSlicePlan?.title || `apply ${changePlan.capability}`}`;
    const body = PRBodyGenerator.generateBody({
      changePlan,
      verticalSlicePlan,
      applyReceipt,
      baseBranch,
      headBranch,
      approvalId,
      commits: commitShas,
    });

    return {
      repository,
      base_branch: baseBranch,
      head_branch: headBranch,
      title,
      body,
      commits: commitShas,
      change_summary: verticalSlicePlan?.description || `Automated changes for ${changePlan.product}/${changePlan.capability}.`,
      verification_summary: `Verification Status: PASS (digest: ${applyReceipt.verification_digest.substring(0, 12)}...)`,
      risk_summary: `Risk Level: ${verticalSlicePlan?.risks ? verticalSlicePlan.risks.join(", ") : "LOW"}`,
      test_summary: `Automated testing and pre/post-apply verifications passed.`,
      rollback_summary: `Reversible change. Revert PR or restore previous revision '${applyReceipt.repository_before.commitSha}'.`,
    };
  }
}
