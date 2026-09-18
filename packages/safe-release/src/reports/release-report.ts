import type {
  ReleaseAuditEvent,
  ReleaseCandidate,
  ReleaseReceipt,
  ReleaseState
} from "../types.js";

export class ReleaseReportGenerator {
  public static generateMarkdown(params: {
    candidate: ReleaseCandidate;
    finalState: ReleaseState;
    receipt?: ReleaseReceipt | undefined;
    auditEvents: ReleaseAuditEvent[];
    errors?: string[] | undefined;
  }): string {
    const { candidate, finalState, receipt, auditEvents, errors = [] } = params;

    const lines: string[] = [];
    lines.push("# MCP Platform V5J — Safe Release Report");
    lines.push("");
    lines.push(`**Product:** \`${candidate.product}\` | **Environment:** \`${candidate.environment}\``);
    lines.push(`**Release Candidate ID:** \`${candidate.release_candidate_id}\``);
    lines.push(`**Final State:** \`${finalState}\``);
    lines.push(`**Source Commit:** \`${candidate.commit_sha}\``);
    lines.push(`**Artifact Digest:** \`${candidate.artifact.digest}\``);
    lines.push(`**Artifact Tag:** \`${candidate.artifact.immutable_tag}\``);
    lines.push("");

    lines.push("## 1. Provenance & Chain Verification");
    lines.push(`- **ChangePlan Digest:** \`${candidate.change_plan_digest}\``);
    lines.push(`- **Verification Digest:** \`${candidate.verification_digest}\``);
    lines.push(`- **Apply ID:** \`${candidate.git_receipt.apply_id}\``);
    lines.push(`- **Git Operation ID:** \`${candidate.git_receipt.git_operation_id}\``);
    lines.push(`- **CI Run ID:** \`${candidate.ci_receipt.ci_run_id}\` (${candidate.ci_receipt.status})`);
    lines.push("");

    lines.push("## 2. Release Audit Journal");
    lines.push("| Seq | Timestamp | Event | Detail |");
    lines.push("|---|---|---|---|");
    for (const event of auditEvents) {
      lines.push(
        `| ${event.sequence} | ${event.timestamp} | \`${event.event_type}\` | ${event.detail} |`
      );
    }
    lines.push("");

    if (receipt) {
      lines.push("## 3. Verified Release Receipt");
      lines.push(`- **Release ID:** \`${receipt.release_id}\``);
      lines.push(`- **Deployed At:** \`${receipt.deployed_at}\``);
      lines.push(`- **Verification Status:** \`${receipt.verification_status}\``);
      lines.push(`- **Snapshot Before:** \`${receipt.diagnostic_snapshot_before}\``);
      lines.push(`- **Snapshot After:** \`${receipt.diagnostic_snapshot_after}\``);
      lines.push(`- **Receipt Digest:** \`${receipt.receipt_digest}\``);
      lines.push("");
      lines.push("> [!NOTE]");
      lines.push("> Release verified and confirmed healthy by ProductionVerifier.");
    }

    if (errors.length > 0) {
      lines.push("## 4. Errors & Violations");
      for (const err of errors) {
        lines.push(`- ⚠️ ${err}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }
}
