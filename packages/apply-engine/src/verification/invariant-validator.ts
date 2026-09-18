import type { ApprovalReceipt } from "../types.js";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";

export class InvariantValidator {
  public static validateInvariants(params: {
    verificationReceipt?: VerificationReceipt;
    approvalReceipt?: ApprovalReceipt;
    hasSnapshot: boolean;
    dirtyWorktreeBlocked: boolean;
  }): { passed: boolean; violatedInvariant?: string } {
    if (!params.verificationReceipt) {
      return { passed: false, violatedInvariant: "NO VERIFICATION RECEIPT → NO APPLY" };
    }

    if (!params.approvalReceipt) {
      return { passed: false, violatedInvariant: "NO APPROVAL RECEIPT → NO APPLY" };
    }

    if (!params.hasSnapshot) {
      return { passed: false, violatedInvariant: "NO BACKUP/SNAPSHOT → NO APPLY" };
    }

    if (!params.dirtyWorktreeBlocked) {
      return { passed: false, violatedInvariant: "DIRTY WORKTREE → NO APPLY" };
    }

    return { passed: true };
  }
}
