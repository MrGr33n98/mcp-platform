import type { Evidence, ValidationStatus } from "@mcp-platform/repository-intelligence";

export type CapabilityStatus =
  | "PASS"
  | "PARTIAL"
  | "FAIL"
  | "MISSING"
  | "NOT_APPLICABLE"
  | "NOT_VERIFIED";

export type RequirementSeverity = "P0_CRITICAL" | "P1_MAJOR" | "P2_NORMAL" | "P3_MINOR";
export type GapPriority = "P0" | "P1" | "P2" | "P3";

export interface RequirementAudit {
  requirementId: string;
  title: string;
  severity: RequirementSeverity;
  status: CapabilityStatus;
  evidence: Evidence[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
}

export interface CapabilityAudit {
  capabilityId: string;
  name: string;
  status: CapabilityStatus;
  priority: GapPriority;
  evidencePaths: string[];
  evidence: Evidence[];
  requirements: RequirementAudit[];
  existingImplementation: string;
  missingPieces: string[];
  securityGaps: string[];
  testGaps: string[];
  dependencies: string[];
}

export interface GapReport {
  generatedAt: string;
  repository: {
    path: string;
    name: string;
  };
  validationStatus: ValidationStatus;
  overallScore: number | null;
  scoreBreakdown?: {
    p0_security_tenancy: number;
    p1_monetization_integrity: number;
    p2_operations_observability: number;
    p3_ux_branding: number;
  } | undefined;
  summary: {
    total: number;
    pass: number;
    partial: number;
    missing: number;
    fail: number;
    not_verified: number;
    not_applicable: number;
  };
  audits: CapabilityAudit[];
  factualExplanation?: string | undefined;
}
