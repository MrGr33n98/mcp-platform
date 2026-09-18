import type { ToolDefinition } from "@mcp-platform/core";
import { RepositoryScanner } from "@mcp-platform/repository-intelligence";
import { ArchitectureGraphBuilder } from "@mcp-platform/architecture-graph";
import { GapEngine, ReportGenerator } from "@mcp-platform/saas-gap-analyzer";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import { analyzeSaasGapsInputSchema } from "../schemas/gap.js";

export function createAnalyzeSaasGapsTool(): ToolDefinition<typeof analyzeSaasGapsInputSchema> {
  return {
    name: "engineering_analyze_saas_gaps",
    description: "Analyze repository against the 11 Golden SaaS capabilities producing an evidence-based gap report.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: analyzeSaasGapsInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const manifest = await RepositoryScanner.scan(canonicalRoot);
      const graph = ArchitectureGraphBuilder.build(manifest);

      const report = GapEngine.analyze(manifest, graph);
      const markdown = ReportGenerator.generateMarkdown(report);

      return {
        repository_path: canonicalRoot,
        validation_status: report.validationStatus,
        overall_score: report.overallScore,
        score_breakdown: report.scoreBreakdown,
        summary: report.summary,
        audits: report.audits,
        markdown_report: markdown,
      };
    },
  };
}
