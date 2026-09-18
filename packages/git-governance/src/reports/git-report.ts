import type { GitReport, GitReceipt } from "../types.js";

export class GitReportGenerator {
  public static createReceipt(report: GitReport): GitReceipt {
    const commitSha = report.commit_report?.commit_metadata.commit_sha || "UNKNOWN_COMMIT";
    const commitDiffDigest = report.commit_report?.commit_metadata.diff_digest || report.diff_report.diff_digest;

    const pushStatus = report.push_report?.status === "SUCCESS" ? "PUSHED" : "LOCAL_ONLY";
    const prStatus = report.pr_report?.status === "CREATED" ? "PR_CREATED" : "NOT_REQUESTED";

    return {
      schema_version: 1,
      receipt_type: "GIT_RECEIPT",
      git_operation_id: report.git_operation_id,
      repository: report.repository,
      source_revision: report.source_revision,
      branch: report.branch,
      commit_sha: commitSha,
      commit_diff_digest: commitDiffDigest,
      change_plan_digest: report.change_plan_digest,
      verification_digest: report.verification_digest,
      apply_id: report.apply_id,
      push_status: pushStatus,
      pr_status: prStatus,
      status: report.status,
      timestamp: new Date().toISOString(),
    };
  }

  public static generateMarkdown(report: GitReport): string {
    const commitSha = report.commit_report?.commit_metadata.commit_sha || "N/A";
    const parentSha = report.commit_report?.commit_metadata.parent_sha || "N/A";
    const secretCount = report.secret_findings.length;

    const filesTable = report.diff_report.files
      .map(
        f =>
          `| \`${f.path}\` | \`${f.status}\` | +${f.lines_added} / -${f.lines_removed} | \`${f.classification}\` |`
      )
      .join("\n");

    const secretsSection =
      secretCount === 0
        ? "✅ **Zero secrets detected in staged diff.**"
        : `⚠️ **${secretCount} Secret Finding(s) Reported:**\n` +
          report.secret_findings
            .map(
              s =>
                `- **[${s.severity}]** \`${s.file}:${s.line}\` — ${s.secret_type} (${s.redacted_fingerprint})`
            )
            .join("\n");

    const prSection = report.pr_report
      ? `- **PR Provider:** \`${report.pr_report.provider}\`\n- **PR Status:** \`${report.pr_report.status}\`\n- **PR URL:** ${report.pr_report.pr_url || "N/A"}`
      : "Nenhum PR solicitado nesta operação.";

    return `# Git Governance Report — ${report.git_operation_id}

## 📊 Summary & Status

- **Status:** \`${report.status}\`
- **Repository:** \`${report.repository}\`
- **Branch:** \`${report.branch}\`
- **Source Commit:** \`${report.source_revision.commitSha}\`
- **Commit SHA:** \`${commitSha}\`
- **Parent SHA:** \`${parentSha}\`
- **Timestamp:** \`${report.created_at}\`

---

## 🔒 Secret Scanning & Safety

${secretsSection}

---

## 📁 Diff & Change Surface

- **Total Lines Added:** +${report.diff_report.total_lines_added}
- **Total Lines Removed:** -${report.diff_report.total_lines_removed}
- **Diff Digest (SHA-256):** \`${report.diff_report.diff_digest.substring(0, 16)}...\`
- **Consistent with Plan:** ${report.diff_report.is_consistent_with_plan ? "✅ YES" : "❌ NO"}

| Path | Status | Lines (+/-) | Classification |
| :--- | :--- | :--- | :--- |
${filesTable || "| (No files modified) | - | - | - |"}

---

## 🚀 Push & Pull Request Status

${prSection}

---

## 🏷️ Provenance & Cryptographic Receipts

| Parameter | Value |
| :--- | :--- |
| **Apply ID** | \`${report.apply_id}\` |
| **Approval ID** | \`${report.approval_id}\` |
| **ChangePlan Digest** | \`${report.change_plan_digest.substring(0, 16)}...\` |
| **Verification Digest** | \`${report.verification_digest.substring(0, 16)}...\` |
`;
  }
}
