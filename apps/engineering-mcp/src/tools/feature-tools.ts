import type { ToolDefinition } from "@mcp-platform/core";
import { RepositoryScanner } from "@mcp-platform/repository-intelligence";
import { ArchitectureGraphBuilder } from "@mcp-platform/architecture-graph";
import { GapEngine } from "@mcp-platform/saas-gap-analyzer";
import { FeatureEngineeringEngine } from "@mcp-platform/feature-engineering";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import { planFeatureInputSchema } from "../schemas/feature.js";

export function createPlanFeatureTool(): ToolDefinition<typeof planFeatureInputSchema> {
  return {
    name: "engineering_plan_feature",
    description: "Plan vertical slice feature engineering without mutating disk (PLAN_ONLY).",
    readOnly: true,
    riskLevel: "read",
    inputSchema: planFeatureInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const manifest = await RepositoryScanner.scan(canonicalRoot);
      const graph = ArchitectureGraphBuilder.build(manifest);
      const gapReport = GapEngine.analyze(manifest, graph);

      const result = FeatureEngineeringEngine.plan(manifest, graph, gapReport, {
        productName: input.product_name || manifest.repository.name,
        targetCapability: input.target_capability,
        ...input.options,
      });

      return {
        repository_path: canonicalRoot,
        product: result.changePlan.product,
        capability: result.changePlan.capability,
        operations_count: result.changePlan.operations.length,
        vertical_slice_plan: result.verticalSlicePlan,
        change_plan: result.changePlan,
        markdown_report: result.markdownReport,
      };
    },
  };
}
