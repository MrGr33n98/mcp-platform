import type { VerificationReceipt, VerificationReport } from "../types.js";

export class MarkdownReporter {
  public static generate(report: VerificationReport, receipt: VerificationReceipt): string {
    const lines: string[] = [];

    const statusBadge =
      report.status === "PASS"
        ? "✅ **PASS (APROVADO PARA REVISÃO HUMANA)**"
        : report.status === "CONDITIONAL_PASS"
        ? "⚠️ **CONDITIONAL PASS (PASSOU COM RESSALVAS/AVISOS)**"
        : "❌ **FAIL (BLOQUEADO POR FALHA DE VERIFICAÇÃO)**";

    lines.push(`# RELATÓRIO DE VERIFICAÇÃO ARQUITETURAL`);
    lines.push(`## Feature Plan Verification & Safety Gate (Phase 5F)`);
    lines.push(``);
    lines.push(`**Status da Verificação:** ${statusBadge}  `);
    lines.push(`**Verification ID:** \`${report.verification_id}\`  `);
    lines.push(`**Target:** \`${report.target.product}\` / Capability: \`${report.target.capability}\`  `);
    lines.push(`**Modo Operacional:** \`${report.mode}\` (Estritamente Read-Only / Zero Writes)  `);
    lines.push(`**Data de Execução:** ${report.created_at}  `);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 1. Integridade Criptográfica & Amarração Git`);
    lines.push(``);
    lines.push(`| Atributo | Valor Registrado | Status de Validade |`);
    lines.push(`| :--- | :--- | :--- |`);
    lines.push(`| **ChangePlan Digest (SHA-256)** | \`${report.change_plan_digest.substring(0, 16)}...\` | ✅ Válido |`);
    lines.push(`| **Git Commit SHA** | \`${report.repository_revision.commitSha.substring(0, 12)}\` | ✅ Vinculado |`);
    lines.push(`| **Git Branch** | \`${report.repository_revision.branch}\` | ✅ Ativo |`);
    lines.push(`| **Dirty Working Tree** | \`${report.repository_revision.dirty ? "DIRTY" : "CLEAN"}\` | ✅ Monitorado |`);
    lines.push(``);
    lines.push(`> [!NOTE]`);
    lines.push(`> Este relatório pertence estritamente a este commit e a esta versão do ChangePlan. Qualquer alteração subsequente invalidará este recibo (prevenção formal de TOCTOU).`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 2. Matriz de Verificações Arquiteturais (${report.coverage.passedChecks}/${report.coverage.totalChecks} PASS)`);
    lines.push(``);
    lines.push(`| ID | Verificação | Categoria | Tipo | Veredito | Mensagem |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
    for (const chk of report.checks) {
      const vIcon = chk.verdict === "PASS" ? "✅ PASS" : chk.verdict === "WARNING" ? "⚠️ WARN" : "❌ FAIL";
      lines.push(`| \`${chk.id}\` | ${chk.name} | \`${chk.category}\` | \`${chk.status}\` | ${vIcon} | ${chk.message} |`);
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 3. Change Surface (Superfície de Mudança)`);
    lines.push(``);
    lines.push(`- **Total de Operações Planejadas:** ${report.change_surface.total_operations}`);
    lines.push(`- **Arquivos a Criar (${report.change_surface.files_to_create.length}):**`);
    for (const f of report.change_surface.files_to_create) {
      lines.push(`  - \`${f}\``);
    }
    if (report.change_surface.files_to_modify.length > 0) {
      lines.push(`- **Arquivos a Modificar (${report.change_surface.files_to_modify.length}):**`);
      for (const f of report.change_surface.files_to_modify) {
        lines.push(`  - \`${f}\``);
      }
    }
    if (report.change_surface.tables_affected.length > 0) {
      lines.push(`- **Tabelas de Banco Criadas/Alteradas:** ${report.change_surface.tables_affected.map((t) => `\`${t}\``).join(", ")}`);
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 4. Blast Radius (Raio de Impacto Arquitetural)`);
    lines.push(``);
    lines.push(`- **Componentes Diretamente Impactados (${report.blast_radius.direct.length}):**`);
    for (const d of report.blast_radius.direct) {
      lines.push(`  - ${d}`);
    }
    if (report.blast_radius.critical.length > 0) {
      lines.push(`- **Fronteiras Críticas Monitoradas:** ${report.blast_radius.critical.join(", ")}`);
    }
    if (report.blast_radius.testsProtecting.length > 0) {
      lines.push(`- **Suítes de Teste Existentes que Protegem os Componentes:**`);
      for (const t of report.blast_radius.testsProtecting) {
        lines.push(`  - \`${t}\``);
      }
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 5. Recibo Oficial de Verificação (VerificationReceipt)`);
    lines.push(``);
    lines.push(`\`\`\`json`);
    lines.push(JSON.stringify(receipt, null, 2));
    lines.push(`\`\`\``);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 6. Governança & Próximos Passos`);
    lines.push(``);
    lines.push(`- **Approval Status:** \`${report.approval_status}\``);
    lines.push(`- **Regra de Execução:** Nenhuma operação de escrita é autorizada sem o \`ApprovalReceipt\` assinado pelo operador humano.`);
    lines.push(`- **Fase Subsequente:** Pronta para receber aprovação humana e prosseguir para a **Phase 5G (Hotfix & Apply Engine)**.`);

    return lines.join("\n");
  }
}
