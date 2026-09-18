import type { RepositoryManifest, ProductWorkspace } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { GapReport } from "@mcp-platform/saas-gap-analyzer";
import type { ChangePlan, FeatureEngineeringOptions, VerticalSlicePlan } from "./types.js";
import { VerticalSlicePlanner } from "./vertical-slice-planner.js";
import { ChangePlanner } from "./change-planner.js";
import { PlanReporter } from "./plan-reporter.js";

export interface FeatureEngineeringResult {
  verticalSlicePlan: VerticalSlicePlan;
  changePlan: ChangePlan;
  markdownReport: string;
}

export class FeatureEngineeringEngine {
  public static planWorkspace(
    workspace: ProductWorkspace,
    graph: ArchitectureGraphData,
    gapReport: GapReport,
    options?: FeatureEngineeringOptions | undefined
  ): FeatureEngineeringResult {
    const manifests = Object.values(workspace.manifests);
    const primaryManifest = manifests.find((m) => m.stack.backend === "rails") || manifests[0];

    if (!primaryManifest) {
      throw new Error(`Cannot plan feature engineering: No application manifests found in workspace '${workspace.name}'.`);
    }

    return this.plan(primaryManifest, graph, gapReport, {
      ...options,
      productName: options?.productName || workspace.name
    });
  }

  public static plan(
    manifest: RepositoryManifest,
    graph: ArchitectureGraphData,
    gapReport: GapReport,
    options?: FeatureEngineeringOptions | undefined
  ): FeatureEngineeringResult {
    const productName = options?.productName || manifest.repository.name || "oest";
    const targetCapability = options?.targetCapability;

    // 1. Plan Vertical Slice with Pattern Matching and Invariant Enforcement
    const verticalSlicePlan = VerticalSlicePlanner.plan(
      manifest,
      graph,
      gapReport,
      targetCapability
    );

    // 2. Generate Machine-Readable ChangePlan in PLAN_ONLY mode
    const changePlan = ChangePlanner.planChanges(verticalSlicePlan, productName);

    // 3. Render Human-Verifiable Markdown Document
    const markdownReport = PlanReporter.generateMarkdown(verticalSlicePlan, changePlan);

    return {
      verticalSlicePlan,
      changePlan,
      markdownReport
    };
  }
}
