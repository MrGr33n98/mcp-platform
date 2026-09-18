import type { DiffReport } from "../types.js";

export class DiffReportBuilder {
  public static generateMarkdown(diff: DiffReport): string {
    const lines: string[] = [];
    lines.push("# RELATÓRIO DE DIFF E CONFORMIDADE DE SUPERFÍCIE\n");
    lines.push(`**Conformidade com o Plano:** ${diff.matches_plan ? "✅ 100% MATCH" : "❌ DISCREPÂNCIAS DETECTADAS"}\n`);

    lines.push(`- **Arquivos Planejados:** ${diff.planned_surface.paths.length}`);
    lines.push(`- **Arquivos Criados:** ${diff.actual_surface.files_created.length}`);
    lines.push(`- **Arquivos Modificados:** ${diff.actual_surface.files_modified.length}`);
    lines.push(`- **Linhas Adicionadas:** ${diff.actual_surface.lines_added}`);
    lines.push(`- **Linhas Removidas:** ${diff.actual_surface.lines_removed}`);

    if (diff.unexpected_mutations.length > 0) {
      lines.push(`\n### ⚠️ Mutações Não Declaradas (Violação de Segurança)`);
      for (const u of diff.unexpected_mutations) {
        lines.push(`- \`${u}\``);
      }
    }

    if (diff.missing_mutations.length > 0) {
      lines.push(`\n### ⚠️ Mutações Faltantes`);
      for (const m of diff.missing_mutations) {
        lines.push(`- \`${m}\``);
      }
    }

    return lines.join("\n");
  }
}
