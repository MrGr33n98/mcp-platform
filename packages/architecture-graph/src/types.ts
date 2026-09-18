export type ArchitectureNodeType =
  | "ROUTE"
  | "CONTROLLER"
  | "POLICY"
  | "SERVICE"
  | "MODEL"
  | "TABLE"
  | "MIGRATION"
  | "JOB"
  | "MAILER"
  | "ADMIN_RESOURCE"
  | "NEXT_ROUTE"
  | "NEXT_PAGE"
  | "COMPONENT"
  | "HOOK"
  | "API_CLIENT"
  | "EXTERNAL_SERVICE"
  | "QUEUE"
  | "CACHE"
  | "STORAGE"
  | "TEST_SPEC";

export type ArchitectureEdgeType =
  | "ROUTES_TO"
  | "CALLS"
  | "AUTHORIZES_WITH"
  | "READS"
  | "WRITES"
  | "ENQUEUES"
  | "DELIVERS"
  | "USES"
  | "DEPENDS_ON"
  | "RENDERS"
  | "FETCHES"
  | "PERSISTS_TO"
  | "TESTS"
  | "COVERS";

export type EdgeConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface EdgeEvidence {
  file: string;
  line?: number | undefined;
  symbol?: string | undefined;
  rule?: string | undefined;
  reason: string;
}

export interface ArchitectureNode {
  id: string;
  type: ArchitectureNodeType;
  name: string;
  file: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface ArchitectureEdge {
  edgeId: string;
  source: string;
  target: string;
  type: ArchitectureEdgeType;
  confidence: EdgeConfidence;
  evidence: EdgeEvidence;
}

export interface ArchitectureGraphData {
  graphVersion: number;
  generatedAt: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}
