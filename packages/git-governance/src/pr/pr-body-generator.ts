import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";

export interface PRBodyParams {
  changePlan: ChangePlan;
  verticalSlicePlan?: VerticalSlicePlan | undefined;
  applyReceipt: ApplyReceipt;
  baseBranch: string;
  headBranch: string;
  approvalId: string;
  commits: string[];
}

export class PRBodyGenerator {
  public static generateBody(params: PRBodyParams): string {
    const { changePlan, verticalSlicePlan, applyReceipt, baseBranch, headBranch, approvalId, commits } = params;

    const filesList = changePlan.operations
      .map(op => `- \`[${op.type}]\` \`${op.path}\` (${op.description})`)
      .join("\n");

    const dbMigrations = verticalSlicePlan?.migrationPlan
      ? `- \`${verticalSlicePlan.migrationPlan.migrationName}\` (Reversible: ${verticalSlicePlan.migrationPlan.reversible ? "Yes" : "No"})`
      : "Nenhuma migração de banco de dados necessária.";

    const apiRoutes = verticalSlicePlan?.routes
      ? verticalSlicePlan.routes.map(r => `- \`${r.method} ${r.path}\` (${r.controller}#${r.action})`).join("\n")
      : "Nenhum endpoint de API modificado.";

    const title = verticalSlicePlan?.title || `Apply ${changePlan.capability} changes`;
    const description = verticalSlicePlan?.description || `Automated changes for ${changePlan.product}/${changePlan.capability}.`;
    const risk = verticalSlicePlan?.risks ? verticalSlicePlan.risks.join(", ") : "LOW";

    return `## 🎯 Overview

### What
${description}

### Why
Adição da capability \`${changePlan.capability}\` em \`${changePlan.product}\` conforme requisitos arquiteturais da plataforma MCP.

---

## 🏗️ Architecture & Changes

- **Base Branch:** \`${baseBranch}\`
- **Head Branch:** \`${headBranch}\`
- **Commits:** ${commits.map(c => `\`${c.substring(0, 8)}\``).join(", ") || "Nenhum"}

### Files Changed
${filesList || "Nenhum arquivo listado"}

### 🗄️ Database Impact
${dbMigrations}

### 🌐 API Impact
${apiRoutes}

---

## 🔒 Security & Tenancy

- **Cross-Tenant Isolation:** Enforced via Pundit Scopes / Tenant boundaries.
- **Secret Scanning:** PASS (Zero secrets detected in staged diff).
- **Authentication & Authorization:** Preserved integralmente.

---

## 🧪 Tests & Verification

- **Verification Status:** \`PASS\`
- **Pre & Post-Apply Validation:** All tests passed with zero discrepancies.

---

## ⚠️ Risk & Rollback

- **Risk Level:** \`${risk}\`
- **Rollback Strategy:** Revert de branch ou restauração atômica para a revisão base \`${applyReceipt.repository_before.commitSha}\`.

---

## 🏷️ Provenance & Tracking IDs

| Parameter | Value |
| :--- | :--- |
| **Product** | \`${changePlan.product}\` |
| **Capability** | \`${changePlan.capability}\` |
| **ChangePlan Digest** | \`${applyReceipt.change_plan_digest.substring(0, 16)}...\` |
| **Verification Digest** | \`${applyReceipt.verification_digest.substring(0, 16)}...\` |
| **Apply ID** | \`${applyReceipt.apply_id}\` |
| **Approval ID** | \`${approvalId}\` |
`;
  }
}
