import type { ToolDefinition } from "@mcp-platform/core";
import { getPlatformInfoInputSchema, listCapabilitiesInputSchema } from "../schemas/discovery.js";

export const V5_ENGINES_METADATA = [
  {
    package: "@mcp-platform/repository-intelligence",
    name: "Repository Intelligence",
    description: "Deep AST parsing, framework detection, and security/secret scanning for Rails & Next.js.",
    status: "READY",
  },
  {
    package: "@mcp-platform/architecture-graph",
    name: "Architecture Graph",
    description: "Multi-layered deterministic architecture graph builder and dependency/impact analyzer.",
    status: "READY",
  },
  {
    package: "@mcp-platform/saas-gap-analyzer",
    name: "SaaS Gap Analyzer",
    description: "Audits 11 golden SaaS architectural capabilities against evidence-backed benchmarks.",
    status: "READY",
  },
  {
    package: "@mcp-platform/feature-engineering",
    name: "Feature Engineering Engine",
    description: "Autonomous planning of full vertical slices, DB migrations, policies, controllers, and tests in PLAN_ONLY mode.",
    status: "READY",
  },
  {
    package: "@mcp-platform/verification-engine",
    name: "Verification Engine",
    description: "Pre-apply verification, invariant checking, blast radius analysis, and cryptographic receipt generation.",
    status: "READY",
  },
  {
    package: "@mcp-platform/apply-engine",
    name: "Controlled Apply Engine",
    description: "Safe transactional mutation of repositories with preflight locks, bytecode snapshots, diff validation, and rollback.",
    status: "READY",
  },
  {
    package: "@mcp-platform/git-governance",
    name: "Git Governance Engine",
    description: "Branch isolation, selective staging, secret-in-diff blocking, governed commits, and PR generation.",
    status: "READY",
  },
  {
    package: "@mcp-platform/production-diagnostics",
    name: "Production Diagnostics Engine",
    description: "Incident triage, temporal correlation, automated hypothesis generation, and diagnostic receipts.",
    status: "READY",
  },
  {
    package: "@mcp-platform/safe-release",
    name: "Safe Release Engine",
    description: "Deployment state machine, canary analysis, production verification probes, and deterministic rollback.",
    status: "READY",
  },
];

export const REGISTERED_TOOLS_METADATA = [
  {
    name: "engineering_get_platform_info",
    category: "Discovery",
    engine: "@mcp-platform/core",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "Get platform and runtime info for the Engineering MCP Server.",
  },
  {
    name: "engineering_list_capabilities",
    category: "Discovery",
    engine: "@mcp-platform/core",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "List all engineering capabilities, tools, risk classifications and engine metadata.",
  },
  {
    name: "engineering_scan_repository",
    category: "Repository Intelligence",
    engine: "@mcp-platform/repository-intelligence",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "Scan repository root or workspace to generate comprehensive structural manifest.",
  },
  {
    name: "engineering_get_repository_evidence",
    category: "Repository Intelligence",
    engine: "@mcp-platform/repository-intelligence",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "Retrieve and filter evidence items discovered by repository detectors.",
  },
  {
    name: "engineering_build_architecture_graph",
    category: "Architecture",
    engine: "@mcp-platform/architecture-graph",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "Build deterministic multi-layer architecture graph and optional component impact analysis.",
  },
  {
    name: "engineering_analyze_saas_gaps",
    category: "Gap Analysis",
    engine: "@mcp-platform/saas-gap-analyzer",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "Analyze repository against the 11 Golden SaaS capabilities producing an evidence-based gap report.",
  },
  {
    name: "engineering_plan_feature",
    category: "Feature Engineering",
    engine: "@mcp-platform/feature-engineering",
    risk_level: "PLAN" as const,
    mutates_repository: false,
    description: "Plan vertical slice feature engineering without mutating disk (PLAN_ONLY).",
  },
  {
    name: "engineering_analyze_blast_radius",
    category: "Verification",
    engine: "@mcp-platform/verification-engine",
    risk_level: "PLAN" as const,
    mutates_repository: false,
    description: "Analyze blast radius, affected dependencies and protecting test suites for planned changes.",
  },
  {
    name: "engineering_verify_change",
    category: "Verification",
    engine: "@mcp-platform/verification-engine",
    risk_level: "PLAN" as const,
    mutates_repository: false,
    description: "Verify planned change against architectural invariants and generate cryptographic VerificationReceipt.",
  },
  {
    name: "engineering_preview_apply",
    category: "Controlled Apply",
    engine: "@mcp-platform/apply-engine",
    risk_level: "PLAN" as const,
    mutates_repository: false,
    description: "Simulate change application in dry-run mode with zero filesystem mutations.",
  },
  {
    name: "engineering_apply_change",
    category: "Controlled Apply",
    engine: "@mcp-platform/apply-engine",
    risk_level: "HIGH_RISK" as const,
    mutates_repository: true,
    description: "Apply verified change plan with transaction locks, snapshot protection, diff check, and rollback.",
  },
  {
    name: "engineering_rollback_apply",
    category: "Controlled Apply",
    engine: "@mcp-platform/apply-engine",
    risk_level: "HIGH_RISK" as const,
    mutates_repository: true,
    description: "Restore repository to byte-for-byte pre-mutation snapshot following a failed apply.",
  },
  {
    name: "engineering_git_status",
    category: "Git Governance",
    engine: "@mcp-platform/git-governance",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "Query git repository status, current branch, HEAD commit, and working tree cleanliness.",
  },
  {
    name: "engineering_prepare_branch",
    category: "Git Governance",
    engine: "@mcp-platform/git-governance",
    risk_level: "WRITE" as const,
    mutates_repository: true,
    description: "Validate and create an isolated working branch avoiding protected branches.",
  },
  {
    name: "engineering_prepare_commit",
    category: "Git Governance",
    engine: "@mcp-platform/git-governance",
    risk_level: "HIGH_RISK" as const,
    mutates_repository: true,
    description: "Perform selective staging, secret-in-diff verification, and create governed commit with receipts.",
  },
  {
    name: "engineering_diagnose_production",
    category: "Production Diagnostics",
    engine: "@mcp-platform/production-diagnostics",
    risk_level: "READ" as const,
    mutates_repository: false,
    description: "Triage production incident, correlate telemetry, and formulate root cause hypotheses with receipts.",
  },
  {
    name: "engineering_release_plan",
    category: "Safe Release",
    engine: "@mcp-platform/safe-release",
    risk_level: "PLAN" as const,
    mutates_repository: false,
    description: "Plan deployment sequence, canary criteria, and health checks for a release candidate.",
  },
  {
    name: "engineering_verify_release",
    category: "Safe Release",
    engine: "@mcp-platform/safe-release",
    risk_level: "HIGH_RISK" as const,
    mutates_repository: false,
    description: "Verify active release host digest, service telemetry, and critical endpoint health probes.",
  },
  {
    name: "engineering_rollback_release",
    category: "Safe Release",
    engine: "@mcp-platform/safe-release",
    risk_level: "HIGH_RISK" as const,
    mutates_repository: true,
    description: "Execute safe rollback to known good release with restoration verification and receipt.",
  },
];

export function createPlatformInfoTool(): ToolDefinition<typeof getPlatformInfoInputSchema> {
  return {
    name: "engineering_get_platform_info",
    description: "Get platform and runtime info for the Engineering MCP Server.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: getPlatformInfoInputSchema,
    execute(_context) {
      return {
        product: "engineering-mcp",
        name: "Engineering Platform MCP Server",
        version: "0.1.0",
        engines_count: V5_ENGINES_METADATA.length,
        tools_count: REGISTERED_TOOLS_METADATA.length,
        status: "OPERATIONAL",
        engines: V5_ENGINES_METADATA,
        security_policy: {
          path_traversal_protection: true,
          stdio_isolation: true,
          hitl_approval_required_for_writes: true,
          replay_protection_enabled: true,
        },
      };
    },
  };
}

export function createListCapabilitiesTool(): ToolDefinition<typeof listCapabilitiesInputSchema> {
  return {
    name: "engineering_list_capabilities",
    description: "List all engineering capabilities, tools, risk classifications and engine metadata.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: listCapabilitiesInputSchema,
    execute(_context, input) {
      let tools = [...REGISTERED_TOOLS_METADATA];

      if (input.filter_engine) {
        const needle = input.filter_engine.toLowerCase();
        tools = tools.filter(
          (t) => t.engine.toLowerCase().includes(needle) || t.category.toLowerCase().includes(needle),
        );
      }

      if (input.filter_risk) {
        tools = tools.filter((t) => t.risk_level === input.filter_risk);
      }

      return {
        total_tools: tools.length,
        tools,
        engines: V5_ENGINES_METADATA,
      };
    },
  };
}
