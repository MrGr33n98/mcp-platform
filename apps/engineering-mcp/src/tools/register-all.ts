import type { ToolRegistry } from "@mcp-platform/core";
import {
  createPlatformInfoTool,
  createListCapabilitiesTool,
} from "./discovery-tools.js";
import {
  createScanRepositoryTool,
  createGetRepositoryEvidenceTool,
} from "./repository-tools.js";
import { createBuildArchitectureGraphTool } from "./architecture-tools.js";
import { createAnalyzeSaasGapsTool } from "./gap-tools.js";
import { createPlanFeatureTool } from "./feature-tools.js";
import {
  createAnalyzeBlastRadiusTool,
  createVerifyChangeTool,
} from "./verification-tools.js";
import {
  createPreviewApplyTool,
  createApplyChangeTool,
  createRollbackApplyTool,
} from "./apply-tools.js";
import {
  createGitStatusTool,
  createPrepareBranchTool,
  createPrepareCommitTool,
} from "./git-tools.js";
import { createDiagnoseProductionTool } from "./diagnostics-tools.js";
import {
  createReleasePlanTool,
  createVerifyReleaseTool,
  createRollbackReleaseTool,
} from "./release-tools.js";

export function registerEngineeringTools(registry: ToolRegistry): void {
  // Discovery
  registry.register(createPlatformInfoTool());
  registry.register(createListCapabilitiesTool());

  // Repository Intelligence
  registry.register(createScanRepositoryTool());
  registry.register(createGetRepositoryEvidenceTool());

  // Architecture
  registry.register(createBuildArchitectureGraphTool());

  // Gap Analysis
  registry.register(createAnalyzeSaasGapsTool());

  // Feature Engineering
  registry.register(createPlanFeatureTool());

  // Verification
  registry.register(createAnalyzeBlastRadiusTool());
  registry.register(createVerifyChangeTool());

  // Controlled Apply
  registry.register(createPreviewApplyTool());
  registry.register(createApplyChangeTool());
  registry.register(createRollbackApplyTool());

  // Git Governance
  registry.register(createGitStatusTool());
  registry.register(createPrepareBranchTool());
  registry.register(createPrepareCommitTool());

  // Production Diagnostics
  registry.register(createDiagnoseProductionTool());

  // Safe Release
  registry.register(createReleasePlanTool());
  registry.register(createVerifyReleaseTool());
  registry.register(createRollbackReleaseTool());
}
