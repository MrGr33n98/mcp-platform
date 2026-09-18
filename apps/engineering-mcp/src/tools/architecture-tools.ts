import type { ToolDefinition } from "@mcp-platform/core";
import { RepositoryScanner } from "@mcp-platform/repository-intelligence";
import {
  ArchitectureGraphBuilder,
  ImpactAnalyzer,
} from "@mcp-platform/architecture-graph";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import { buildArchitectureGraphInputSchema } from "../schemas/architecture.js";

export function createBuildArchitectureGraphTool(): ToolDefinition<typeof buildArchitectureGraphInputSchema> {
  return {
    name: "engineering_build_architecture_graph",
    description: "Build deterministic multi-layer architecture graph and optional component impact analysis.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: buildArchitectureGraphInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const manifest = await RepositoryScanner.scan(canonicalRoot);
      const graph = ArchitectureGraphBuilder.build(manifest);

      let impact = undefined;
      if (input.focus_component) {
        const analyzer = new ImpactAnalyzer(graph);
        const focusNode = analyzer.getNode(input.focus_component) ||
          analyzer.getNode(`model:${input.focus_component}`) ||
          analyzer.getNode(`controller:${input.focus_component}`) ||
          analyzer.getNode(`service:${input.focus_component}`);

        if (focusNode) {
          impact = {
            focus_node: focusNode,
            protecting_tests: analyzer.whatTestsProtectComponent(focusNode.id),
            downstream_dependencies: analyzer.getDownstreamDependencies(focusNode.id),
            upstream_dependents: analyzer.getUpstreamDependents(focusNode.id),
          };
        }
      }

      return {
        repository_path: canonicalRoot,
        graph_version: graph.graphVersion,
        generated_at: graph.generatedAt,
        summary: {
          nodes_count: graph.nodes.length,
          edges_count: graph.edges.length,
          node_types: [...new Set(graph.nodes.map((n) => n.type))],
          edge_types: [...new Set(graph.edges.map((e) => e.type))],
        },
        graph,
        impact,
      };
    },
  };
}
