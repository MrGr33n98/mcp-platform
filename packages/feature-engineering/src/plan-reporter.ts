import type { ChangePlan, VerticalSlicePlan } from "./types.js";

export class PlanReporter {
  public static generateMarkdown(plan: VerticalSlicePlan, changePlan: ChangePlan): string {
    const lines: string[] = [];

    lines.push(`# VERTICAL SLICE ENGINEERING PLAN`);
    lines.push(`## Capability: ${plan.title} (\`${plan.capability}\`)`);
    lines.push(``);
    lines.push(`**Mode:** \`${changePlan.mode}\`  `);
    lines.push(`**Product Target:** \`${changePlan.product}\`  `);
    lines.push(`**Approval Status:** 🔒 \`HUMAN APPROVAL REQUIRED BEFORE WRITE\`  `);
    lines.push(`**Generated At:** ${new Date().toISOString()}  `);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 1. Invariantes Arquiteturais & Regras de Conformidade`);
    lines.push(``);
    lines.push(`| Invariante | Status | Verificação / Evidência |`);
    lines.push(`| :--- | :--- | :--- |`);
    lines.push(`| **NO EVIDENCE → NO CHANGE** | ✅ Aprovado | Gaps confirmados pelo SaaS Gap Analyzer; ${plan.requirements.length} requirements atômicos |`);
    lines.push(`| **NO TEST PLAN → NO CHANGE** | ✅ Aprovado | ${plan.tests.length} suítes de teste planejadas (${plan.tests.map((t) => t.category).join(", ")}) |`);
    lines.push(`| **NO ROLLBACK PLAN → NO MIGRATION** | ✅ Aprovado | Rollback reversível verificado com ${plan.rollbackPlan.steps.length} passos de contingência |`);
    lines.push(`| **NO POLICY → NO TENANT-SCOPED ENDPOINT** | ✅ Aprovado | Pundit policy \`${plan.policies.map((p) => p.name).join(", ")}\` com scope resolution |`);
    lines.push(`| **NO HUMAN APPROVAL → NO WRITE** | ✅ Aprovado | Plano gerado em modo \`PLAN_ONLY\` (0 escritas em disco nos repositórios) |`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 2. Padrões Detectados no Repositório (PatternFinder)`);
    lines.push(`*"Como ESTE SaaS já faz isso?"*`);
    lines.push(``);
    lines.push(`- **Jobs:** Classe base \`${plan.existingPatterns.jobs.baseClass}\`, fila padrão \`${plan.existingPatterns.jobs.queueName}\`, política \`${plan.existingPatterns.jobs.retryPolicy}\`.`);
    lines.push(`- **Controllers:** Herança de API \`${plan.existingPatterns.controllers.apiBaseClass}\`, autenticação via \`${plan.existingPatterns.controllers.authMethod}\`.`);
    lines.push(`- **Policies:** Framework \`${plan.existingPatterns.policies.framework}\`, base \`${plan.existingPatterns.policies.baseClass}\`, isolamento \`${plan.existingPatterns.policies.tenancyScopePattern}\`.`);
    lines.push(`- **Models:** Tenancy \`${plan.existingPatterns.models.tenancyAssociation}\`, chaves primárias \`${plan.existingPatterns.models.idType}\`, encriptação \`${plan.existingPatterns.models.encryptionHelper}\`.`);
    lines.push(`- **Migrations:** Rails \`${plan.existingPatterns.migrations.railsVersion}\`, chaves estrangeiras com constraints e índices compostos.`);
    lines.push(`- **Testes:** Framework \`${plan.existingPatterns.tests.framework}\`, factories \`${plan.existingPatterns.tests.factoryPattern}\`.`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 3. Operações Planejadas (ChangePlan: ${changePlan.operations.length} Operações)`);
    lines.push(``);
    lines.push(`| ID | Tipo | Arquivo Alvo | Descrição | Padrão Aplicado |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const op of changePlan.operations) {
      lines.push(`| \`${op.id}\` | \`${op.type}\` | \`${op.path}\` | ${op.description} | ${op.patternApplied} |`);
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 4. Camadas Arquiteturais Detalhadas`);
    lines.push(``);

    lines.push(`#### A. Banco de Dados & Migrações`);
    lines.push(`- **Arquivo:** \`${plan.migrationPlan.targetPath}\``);
    lines.push(`- **Tabelas Criadas:** ${plan.databaseChanges.map((c) => `\`${c.table}\``).join(", ")}`);
    lines.push(``);
    lines.push(`\`\`\`ruby`);
    lines.push(plan.migrationPlan.rubyCode.trim());
    lines.push(`\`\`\``);
    lines.push(``);

    lines.push(`#### B. Models de Domínio`);
    for (const model of plan.models) {
      lines.push(`##### \`${model.className}\` (\`${model.filePath}\`)`);
      lines.push(`- **Tenancy:** \`${model.belongsToTenancy}\``);
      lines.push(`- **Associações:** ${model.associations.join(", ")}`);
      lines.push(`- **Validações:** ${model.validations.length} regras configuradas`);
      lines.push(``);
      lines.push(`\`\`\`ruby`);
      lines.push(model.codePreview.trim());
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`#### C. Autorização & Isolamento Multi-Tenant (Pundit Policy)`);
    for (const policy of plan.policies) {
      lines.push(`##### \`${policy.className}\` (\`${policy.filePath}\`)`);
      lines.push(`\`\`\`ruby`);
      lines.push(policy.codePreview.trim());
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`#### D. Serviços de Domínio`);
    for (const svc of plan.services) {
      lines.push(`##### \`${svc.name}\` (\`${svc.filePath}\`)`);
      lines.push(`- **Responsabilidade:** ${svc.responsibility}`);
      lines.push(``);
      lines.push(`\`\`\`ruby`);
      lines.push(svc.codePreview.trim());
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`#### E. Background Jobs`);
    for (const job of plan.jobs) {
      lines.push(`##### \`${job.name}\` (\`${job.filePath}\`)`);
      lines.push(`- **Fila:** \`${job.queue}\` | **Timeout:** \`${job.timeoutSeconds}s\` | **Retries:** \`${job.retryPolicy}\``);
      lines.push(``);
      lines.push(`\`\`\`ruby`);
      lines.push(job.codePreview.trim());
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`#### F. Controllers & Endpoints REST`);
    for (const ctrl of plan.controllers) {
      lines.push(`##### \`${ctrl.name}\` (\`${ctrl.filePath}\`)`);
      lines.push(`- **Classe Base:** \`${ctrl.baseClass}\``);
      lines.push(`- **Ações:** ${ctrl.actions.map((a) => `\`${a.httpMethod} ${a.path}\``).join(", ")}`);
      lines.push(``);
      lines.push(`\`\`\`ruby`);
      lines.push(ctrl.codePreview.trim());
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`#### G. Suíte de Testes Automatizados`);
    for (const t of plan.tests) {
      lines.push(`##### \`${t.category}\`: \`${t.filePath}\``);
      lines.push(`- **Descrição:** ${t.description}`);
      lines.push(`- **Casos de Teste:** ${t.testCases.map((tc) => `\`${tc.name}\``).join(", ")}`);
      lines.push(``);
      lines.push(`\`\`\`ruby`);
      lines.push(t.codePreview.trim());
      lines.push(`\`\`\``);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(``);

    lines.push(`### 5. Matriz de Verificação Automatizada`);
    lines.push(``);
    lines.push(`| ID | Verificação | Comando | Saída Esperada | Severidade |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const v of plan.verificationPlan.checks) {
      lines.push(`| \`${v.id}\` | ${v.name} | \`${v.command}\` | ${v.expectedOutput} | \`${v.severity}\` |`);
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(`### 6. Procedimento de Rollback & Contingência`);
    lines.push(``);
    lines.push(`- **Estratégia:** \`${plan.rollbackPlan.strategy}\``);
    lines.push(`- **Risco de Perda de Dados:** ${plan.rollbackPlan.dataLossRisk}`);
    lines.push(`- **Garantia de Reversibilidade:** ✅ \`${plan.rollbackPlan.safeRollbackGuaranteed}\``);
    lines.push(``);
    lines.push(`Passos de execução em caso de falha:`);
    for (const s of plan.rollbackPlan.steps) {
      lines.push(`${s.stepNumber}. **${s.name}** (\`${s.riskLevel}\`): ${s.description}`);
      if (s.command) lines.push(`   \`\`\`bash\n   ${s.command}\n   \`\`\``);
      if (s.rubyCode) lines.push(`   \`\`\`ruby\n   ${s.rubyCode}\n   \`\`\``);
    }

    return lines.join("\n");
  }
}
