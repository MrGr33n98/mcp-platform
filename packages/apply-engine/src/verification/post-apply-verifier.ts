import { VerificationEngine } from "@mcp-platform/verification-engine";
import type { VerificationReport } from "@mcp-platform/verification-engine";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";

export class PostApplyVerifier {
  public static async verify(params: {
    workspaceRoot: string;
    repositoryManifest: RepositoryManifest;
    architectureGraph: ArchitectureGraphData;
    changePlan: ChangePlan;
    verticalSlicePlan: VerticalSlicePlan;
  }): Promise<{ success: boolean; report: VerificationReport; error?: string | undefined }> {
    try {
      const result = await VerificationEngine.verify({
        repositoryManifest: {
          ...params.repositoryManifest,
          repository: {
            ...params.repositoryManifest.repository,
            path: params.workspaceRoot
          }
        },
        architectureGraph: params.architectureGraph,
        changePlan: params.changePlan,
        verticalSlicePlan: params.verticalSlicePlan,
        options: {
          mode: "STATIC_VERIFY"
        }
      });

      const isPass = result.report.status === "PASS";
      return {
        success: isPass,
        report: result.report,
        error: isPass ? undefined : `Post-apply verification ended in '${result.report.status}' (${result.report.failures.length} failures).`
      };
    } catch (err: any) {
      return {
        success: false,
        report: null as any,
        error: `PostApplyVerifier execution exception: ${err.message}`
      };
    }
  }
}
