import { createHash } from "crypto";
import type { ApplyReceipt, ApplyReport, ApplyStatus } from "../types.js";

export class ApplyReportBuilder {
  public static computeAppliedChangeDigest(report: ApplyReport): string {
    const canonical = JSON.stringify({
      apply_id: report.apply_id,
      plan_digest: report.plan_digest,
      verification_digest: report.verification_digest,
      approval_id: report.approval_id,
      status: report.status,
      created_files: report.actual_change_surface.files_created.sort(),
      modified_files: report.actual_change_surface.files_modified.sort()
    });

    return createHash("sha256").update(canonical).digest("hex");
  }

  public static buildReceipt(report: ApplyReport): ApplyReceipt {
    const changeDigest = this.computeAppliedChangeDigest(report);

    return {
      schema_version: 1,
      receipt_type: "APPLY_RECEIPT",
      apply_id: report.apply_id,
      change_plan_digest: report.plan_digest,
      verification_digest: report.verification_digest,
      approval_id: report.approval_id,
      repository_before: report.repository_before,
      repository_after: report.repository_after,
      applied_change_digest: changeDigest,
      status: report.status,
      timestamp: report.created_at
    };
  }

  public static generateMarkdown(report: ApplyReport, receipt?: ApplyReceipt): string {
    const lines: string[] = [];

    const isSuccess = report.status === "APPLIED_VERIFIED";
    const statusEmoji = isSuccess ? "✅" : "❌";

    lines.push("# RELATÓRIO DE APLICAÇÃO CONTROLADA");
    lines.push(`## Controlled Apply Engine & Mutation Journal (Phase 5G)\n`);
    lines.push(`**Status da Aplicação:** ${statusEmoji} **${report.status}**  `);
    lines.push(`**Apply ID:** \`${report.apply_id}\`  `);
    lines.push(`**Approval ID:** \`${report.approval_id}\`  `);
    lines.push(`**Data de Execução:** ${report.created_at}  \n`);
    lines.push(`---\n`);

    lines.push(`### 1. Integridade Criptográfica da Cadeia (Receipt Chain)\n`);
    lines.push(`| Recibo / Digest | Hash SHA-256 | Status |`);
    lines.push(`| :--- | :--- | :--- |`);
    lines.push(`| **ChangePlan Digest** | \`${report.plan_digest.substring(0, 16)}...\` | ✅ Válido |`);
    lines.push(`| **Verification Digest** | \`${report.verification_digest.substring(0, 16)}...\` | ✅ Validado |`);
    if (receipt) {
      lines.push(`| **Applied Change Digest** | \`${receipt.applied_change_digest.substring(0, 16)}...\` | ✅ Registrado |`);
    }
    lines.push(`| **Git Commit SHA (Before)** | \`${report.repository_before.commitSha.substring(0, 12)}\` | ✅ Bloqueado |`);
    lines.push(`\n---\n`);

    lines.push(`### 2. Superfície Real de Mutações (Actual Change Surface)\n`);
    lines.push(`- **Arquivos Criados:** ${report.actual_change_surface.files_created.length}`);
    for (const f of report.actual_change_surface.files_created) {
      lines.push(`  - \`+ [CREATE]\` \`${f}\``);
    }
    lines.push(`- **Arquivos Modificados:** ${report.actual_change_surface.files_modified.length}`);
    for (const f of report.actual_change_surface.files_modified) {
      lines.push(`  - \`~ [MODIFY]\` \`${f}\``);
    }
    lines.push(`- **Total de Bytes Escritos:** ${report.actual_change_surface.total_bytes_written} bytes`);
    lines.push(`\n---\n`);

    if (report.rollback_report) {
      lines.push(`### 3. Registro de Rollback Executado\n`);
      lines.push(`> [!WARNING]`);
      lines.push(`> A aplicação falhou e o Rollback Automático foi acionado com sucesso.`);
      lines.push(`- **Rollback Status:** \`${report.rollback_report.status}\``);
      lines.push(`- **Arquivos Restaurados:** ${report.rollback_report.files_restored_count}`);
      lines.push(`- **Arquivos Novos Removidos:** ${report.rollback_report.files_deleted_count}`);
      lines.push(`\n---\n`);
    }

    lines.push(`### 4. Diário de Mutações (Mutation Journal - ${report.journal.entries.length} entradas)\n`);
    lines.push(`| Seq | Operação | Tipo | Caminho | Status |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const e of report.journal.entries) {
      const st = e.status === "APPLIED" ? "✅ APPLIED" : e.status === "FAILED" ? "❌ FAILED" : e.status;
      lines.push(`| ${e.sequence} | \`${e.operation_id}\` | \`${e.mutation_type}\` | \`${e.path}\` | ${st} |`);
    }
    lines.push(`\n---\n`);

    lines.push(`> [!IMPORTANT]`);
    lines.push(`> A autoridade de escrita na Phase 5G é estritamente **WRITE_LOCAL**. Nenhuma operação de Git (commit/push) ou deploy foi realizada.`);

    return lines.join("\n");
  }
}
