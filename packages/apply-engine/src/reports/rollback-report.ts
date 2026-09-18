import type { RollbackVerificationReport } from "../types.js";

export class RollbackReportBuilder {
  public static generateMarkdown(report: RollbackVerificationReport): string {
    const lines: string[] = [];
    const isSuccess = report.status === "SUCCESS";
    const statusEmoji = isSuccess ? "✅" : "❌";

    lines.push("# RELATÓRIO DE RESTAURAÇÃO DE ROLLBACK\n");
    lines.push(`**Status:** ${statusEmoji} **${report.status}**`);
    lines.push(`**Rollback ID:** \`${report.rollback_id}\``);
    lines.push(`**Transaction ID:** \`${report.transaction_id}\``);
    lines.push(`**Data de Execução:** ${report.restored_at}\n`);

    lines.push(`- **Arquivos Restaurados para Versão Anterior:** ${report.files_restored_count}`);
    lines.push(`- **Arquivos Novos Removidos:** ${report.files_deleted_count}`);

    if (report.discrepancies.length > 0) {
      lines.push(`\n### ⚠️ Discrepâncias Encontradas Pós-Rollback`);
      for (const d of report.discrepancies) {
        lines.push(`- \`${d.path}\`: ${d.reason}`);
      }
    } else {
      lines.push(`\n> [!NOTE]`);
      lines.push(`> Todos os arquivos foram restaurados com exatidão byte-a-byte idêntica ao estado anterior à transação.`);
    }

    return lines.join("\n");
  }
}
