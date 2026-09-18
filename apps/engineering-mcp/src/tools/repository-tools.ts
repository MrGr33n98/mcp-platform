import type { ToolDefinition } from "@mcp-platform/core";
import {
  RepositoryScanner,
  ProductWorkspaceScanner,
  type Evidence,
} from "@mcp-platform/repository-intelligence";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import {
  scanRepositoryInputSchema,
  getRepositoryEvidenceInputSchema,
} from "../schemas/repository.js";

export function createScanRepositoryTool(): ToolDefinition<typeof scanRepositoryInputSchema> {
  return {
    name: "engineering_scan_repository",
    description: "Scan repository root or workspace to generate comprehensive structural manifest.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: scanRepositoryInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);

      if (input.workspace_mode) {
        const workspaceResult = await ProductWorkspaceScanner.scanWorkspace(canonicalRoot);
        return {
          mode: "WORKSPACE",
          repository_path: canonicalRoot,
          workspace: workspaceResult,
        };
      }

      const manifest = await RepositoryScanner.scan(canonicalRoot);
      return {
        mode: "SINGLE_APP",
        repository_path: canonicalRoot,
        manifest,
      };
    },
  };
}

export function createGetRepositoryEvidenceTool(): ToolDefinition<typeof getRepositoryEvidenceInputSchema> {
  return {
    name: "engineering_get_repository_evidence",
    description: "Retrieve and filter evidence items discovered by repository detectors.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: getRepositoryEvidenceInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const manifest = await RepositoryScanner.scan(canonicalRoot);

      const allEvidence: Evidence[] = [];

      if (manifest.validation?.evidence) {
        allEvidence.push(...manifest.validation.evidence);
      }

      for (const route of manifest.backend.routes) {
        if (route.evidence) allEvidence.push(route.evidence);
      }
      for (const model of manifest.backend.models) {
        if (model.evidence) allEvidence.push(model.evidence);
      }
      for (const ctrl of manifest.backend.controllers) {
        if (ctrl.evidence) allEvidence.push(ctrl.evidence);
      }
      for (const pol of manifest.backend.policies) {
        if (pol.evidence) allEvidence.push(pol.evidence);
      }
      for (const srv of manifest.backend.services) {
        if (srv.evidence) allEvidence.push(srv.evidence);
      }
      for (const job of manifest.backend.jobs) {
        if (job.evidence) allEvidence.push(job.evidence);
      }
      if (manifest.tests?.specs) {
        for (const spec of manifest.tests.specs) {
          if (spec.evidence) allEvidence.push(spec.evidence);
        }
      }

      let filtered = allEvidence;
      if (input.evidence_type) {
        filtered = filtered.filter(
          (e) => e.evidence_type.toLowerCase() === input.evidence_type?.toLowerCase(),
        );
      }
      if (input.min_confidence) {
        const confRank: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
        const requiredRank = confRank[input.min_confidence] ?? 1;
        filtered = filtered.filter((e) => (confRank[e.confidence] ?? 1) >= requiredRank);
      }

      return {
        repository_path: canonicalRoot,
        total_evidence_count: allEvidence.length,
        filtered_evidence_count: filtered.length,
        evidence: filtered,
      };
    },
  };
}
