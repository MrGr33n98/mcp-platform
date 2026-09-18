import type { RollbackReceipt } from "../types.js";

export class RollbackReportGenerator {
  public static generateMarkdown(receipt: RollbackReceipt): string {
    const lines: string[] = [];
    lines.push("# MCP Platform V5J — Rollback Report");
    lines.push("");
    lines.push(`**Rollback ID:** \`${receipt.rollback_id}\``);
    lines.push(`**Failed Release ID:** \`${receipt.failed_release_id}\``);
    lines.push(`**Restored Release ID:** \`${receipt.restored_release_id}\``);
    lines.push(`**Restored Artifact Digest:** \`${receipt.restored_artifact_digest}\``);
    lines.push(`**Status:** \`${receipt.verification_status}\``);
    lines.push(`**Timestamp:** \`${receipt.timestamp}\``);
    lines.push("");
    lines.push(`**Reason:** ${receipt.reason}`);
    lines.push(`- **Snapshot Before:** \`${receipt.diagnostics_before}\``);
    lines.push(`- **Snapshot After:** \`${receipt.diagnostics_after}\``);
    lines.push(`- **Receipt Digest:** \`${receipt.receipt_digest}\``);
    return lines.join("\n");
  }
}
