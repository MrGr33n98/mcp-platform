import type { ToolDefinition } from "@mcp-platform/core";
import { RepositoryScanner } from "@mcp-platform/repository-intelligence";
import { ArchitectureGraphBuilder } from "@mcp-platform/architecture-graph";
import { GapEngine } from "@mcp-platform/saas-gap-analyzer";
import {
  FeatureEngineeringEngine,
  type VerticalSlicePlan,
  type ChangePlan,
} from "@mcp-platform/feature-engineering";
import {
  VerificationEngine,
  BlastRadiusAnalyzer,
  type VerificationMode,
} from "@mcp-platform/verification-engine";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import {
  analyzeBlastRadiusInputSchema,
  verifyChangeInputSchema,
} from "../schemas/verification.js";

export function createAnalyzeBlastRadiusTool(): ToolDefinition<typeof analyzeBlastRadiusInputSchema> {
  return {
    name: "engineering_analyze_blast_radius",
    description: "Analyze blast radius, affected dependencies and protecting test suites for planned changes.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: analyzeBlastRadiusInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const manifest = await RepositoryScanner.scan(canonicalRoot);
      const graph = ArchitectureGraphBuilder.build(manifest);

      let slicePlan: VerticalSlicePlan;
      if (input.vertical_slice_plan) {
        slicePlan = input.vertical_slice_plan as unknown as VerticalSlicePlan;
      } else {
        const gapReport = GapEngine.analyze(manifest, graph);
        const planRes = FeatureEngineeringEngine.plan(manifest, graph, gapReport, {
          targetCapability: input.target_capability,
        });
        slicePlan = planRes.verticalSlicePlan;
      }

      const blastRadius = BlastRadiusAnalyzer.analyze(graph, slicePlan);

      return {
        repository_path: canonicalRoot,
        blast_radius: blastRadius,
      };
    },
  };
}

export function createVerifyChangeTool(): ToolDefinition<typeof verifyChangeInputSchema> {
  return {
    name: "engineering_verify_change",
    description: "Verify planned change against architectural invariants and generate cryptographic VerificationReceipt.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: verifyChangeInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const manifest = await RepositoryScanner.scan(canonicalRoot);
      const graph = ArchitectureGraphBuilder.build(manifest);

      const changePlan = input.change_plan as unknown as ChangePlan;
      const verticalSlicePlan = input.vertical_slice_plan as unknown as VerticalSlicePlan;

      const verificationResult = await VerificationEngine.verify({
        changePlan,
        verticalSlicePlan,
        repositoryManifest: manifest,
        architectureGraph: graph,
        options: {
          mode: input.options?.mode as VerificationMode | undefined,
          customRevision: input.options?.customRevision as any,
        },
      });

      return {
        repository_path: canonicalRoot,
        report: verificationResult.report,
        receipt: verificationResult.receipt,
        markdown: verificationResult.markdown,
      };
    },
  };
}
