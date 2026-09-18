import type { ToolDefinition } from "@mcp-platform/core";
import { RepositoryScanner } from "@mcp-platform/repository-intelligence";
import { ArchitectureGraphBuilder } from "@mcp-platform/architecture-graph";
import {
  DiagnosticsEngine,
  type DeploymentRecord,
} from "@mcp-platform/production-diagnostics";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import { diagnoseProductionInputSchema } from "../schemas/diagnostics.js";

export function createDiagnoseProductionTool(): ToolDefinition<typeof diagnoseProductionInputSchema> {
  return {
    name: "engineering_diagnose_production",
    description: "Triage production incident, correlate telemetry, and formulate root cause hypotheses with receipts.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: diagnoseProductionInputSchema,
    async execute(_context, input) {
      let architectureGraph = undefined;

      if (input.repository_path) {
        const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
        const manifest = await RepositoryScanner.scan(canonicalRoot);
        architectureGraph = ArchitectureGraphBuilder.build(manifest);
      }

      const result = await DiagnosticsEngine.diagnose({
        environment: input.environment,
        productName: input.product_name,
        architectureGraph,
        rawLogs: input.raw_logs,
        rawErrors: input.raw_errors,
        rawMetrics: input.raw_metrics,
        deployments: input.deployments as unknown as DeploymentRecord[] | undefined,
        options: {
          timeWindowMinutes: input.time_window_minutes,
        },
      });

      return {
        environment: input.environment,
        product: input.product_name,
        incident_id: result.incident.incident_id,
        incident_title: result.incident.title,
        status: result.incident.status,
        symptoms_count: result.incident.symptoms.length,
        hypotheses_count: result.incident.hypotheses.length,
        receipt: result.receipt,
        incident: result.incident,
        timeline: result.timeline,
        coverage: result.coverage,
        handoff: result.handoff,
        markdown_report: result.markdown,
      };
    },
  };
}
