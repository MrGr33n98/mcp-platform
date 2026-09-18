import type { GapReport } from "./types.js";

export class ReportGenerator {
  public static generateMarkdown(report: GapReport): string {
    const lines: string[] = [];

    lines.push(`# Golden SaaS Capability Gap Report`);
    lines.push(``);
    lines.push(`**Repository:** \`${report.repository.name}\` (\`${report.repository.path}\`)  `);
    lines.push(`**Generated At:** ${report.generatedAt}  `);
    lines.push(`**Validation Status:** \`${report.validationStatus}\`  `);
    
    if (report.overallScore !== null) {
      lines.push(`**Weighted Alignment Score:** **${report.overallScore}/100**  `);
      if (report.scoreBreakdown) {
        lines.push(`- **P0 Security & Tenancy:** ${report.scoreBreakdown.p0_security_tenancy}/100 (Weight: 40%)`);
        lines.push(`- **P1 Monetization & Integrity:** ${report.scoreBreakdown.p1_monetization_integrity}/100 (Weight: 30%)`);
        lines.push(`- **P2 Operations & Observability:** ${report.scoreBreakdown.p2_operations_observability}/100 (Weight: 20%)`);
        lines.push(`- **P3 UX & White-Label:** ${report.scoreBreakdown.p3_ux_branding}/100 (Weight: 10%)`);
      }
    } else {
      lines.push(`**Weighted Alignment Score:** **N/A (NOT VERIFIED)**  `);
      if (report.factualExplanation) {
        lines.push(`> ⚠️ **Factual Validation Notice:** ${report.factualExplanation}`);
      }
    }
    lines.push(``);

    lines.push(`## Summary Matrix`);
    lines.push(``);
    lines.push(`| Total Capabilities | PASS | PARTIAL | MISSING | FAIL | NOT_VERIFIED |`);
    lines.push(`|---|---|---|---|---|---|`);
    lines.push(`| ${report.summary.total} | ${report.summary.pass} | ${report.summary.partial} | ${report.summary.missing} | ${report.summary.fail} | ${report.summary.not_verified} |`);
    lines.push(``);

    lines.push(`## Capability Breakdown`);
    lines.push(``);

    for (const audit of report.audits) {
      const badge =
        audit.status === "PASS"
          ? "✅ PASS"
          : audit.status === "PARTIAL"
          ? "⚠️ PARTIAL"
          : audit.status === "MISSING"
          ? "❌ MISSING"
          : audit.status === "NOT_VERIFIED"
          ? "❓ NOT_VERIFIED"
          : "🚨 FAIL";

      lines.push(`### ${badge} — ${audit.name} (\`${audit.capabilityId}\`)`);
      lines.push(``);
      lines.push(`- **Status:** \`${audit.status}\` | **Priority:** \`${audit.priority}\``);
      lines.push(`- **Existing Implementation:** ${audit.existingImplementation}`);
      
      if (audit.requirements.length > 0) {
        lines.push(`- **Requirements Audit:**`);
        for (const req of audit.requirements) {
          const reqBadge = req.status === "PASS" ? "✅" : req.status === "PARTIAL" ? "⚠️" : req.status === "NOT_VERIFIED" ? "❓" : "❌";
          lines.push(`  - ${reqBadge} **[${req.requirementId}]** ${req.title} (\`${req.severity}\`): ${req.explanation}`);
        }
      }

      if (audit.evidencePaths.length > 0) {
        lines.push(`- **Evidence Paths:**`);
        for (const ep of audit.evidencePaths) {
          lines.push(`  - \`${ep}\``);
        }
      }
      if (audit.missingPieces.length > 0) {
        lines.push(`- **Missing Pieces:**`);
        for (const mp of audit.missingPieces) {
          lines.push(`  - ${mp}`);
        }
      }
      if (audit.securityGaps.length > 0) {
        lines.push(`- **Security Gaps:**`);
        for (const sg of audit.securityGaps) {
          lines.push(`  - ${sg}`);
        }
      }
      if (audit.testGaps.length > 0) {
        lines.push(`- **Test Gaps:**`);
        for (const tg of audit.testGaps) {
          lines.push(`  - ${tg}`);
        }
      }
      lines.push(``);
    }

    return lines.join("\n");
  }
}
