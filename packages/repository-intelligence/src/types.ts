import { z } from "zod";

export type EvidenceType =
  | "FILE_EXISTS"
  | "CODE_SYMBOL"
  | "ROUTE"
  | "MODEL"
  | "ASSOCIATION"
  | "VALIDATION"
  | "POLICY"
  | "DATABASE_CONSTRAINT"
  | "INDEX"
  | "SERVICE"
  | "JOB"
  | "TEST"
  | "CONFIG"
  | "DEPENDENCY"
  | "API_CONTRACT"
  | "FRONTEND_USAGE"
  | "ADMIN_RESOURCE";

export interface Evidence {
  repository?: string | undefined;
  file: string;
  line_start?: number | undefined;
  line_end?: number | undefined;
  symbol?: string | undefined;
  evidence_type: EvidenceType;
  detector?: string | undefined;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export type WorkspaceType = "SINGLE_APP" | "MONOREPO" | "NESTED_BACK_FRONT" | "UNKNOWN";
export type ValidationStatus = "VALID" | "PARTIAL" | "INVALID" | "NOT_VERIFIED";

export interface RepositoryValidationResult {
  status: ValidationStatus;
  workspace_type: WorkspaceType;
  repository_root: string;
  backend_roots: string[];
  frontend_roots: string[];
  nested_apps: string[];
  evidence: Evidence[];
  reason?: string | undefined;
}

export interface ScanCoverage {
  files_discovered: number;
  files_scanned: number;
  files_skipped: number;
  parse_failures: number;
  unsupported_files: number;
  coverage_confidence: "HIGH" | "MEDIUM" | "LOW";
  limitations: string[];
}

export interface RouteDefinition {
  method: string;
  path: string;
  controller: string;
  action: string;
  file: string;
  line?: number | undefined;
  evidence?: Evidence | undefined;
}

export interface ModelDefinition {
  name: string;
  tableName: string;
  file: string;
  associations: {
    type: "belongs_to" | "has_many" | "has_one" | "has_and_belongs_to_many";
    target: string;
    foreignKey?: string | undefined;
  }[];
  attributes: {
    name: string;
    type?: string | undefined;
  }[];
  isTenantScoped: boolean;
  tenantKey?: string | undefined;
  evidence?: Evidence | undefined;
}

export interface ControllerDefinition {
  name: string;
  file: string;
  actions: string[];
  policyUsed?: string | undefined;
  tenantScoped: boolean;
  evidence?: Evidence | undefined;
}

export interface PolicyDefinition {
  name: string;
  file: string;
  model: string;
  actions: string[];
  evidence?: Evidence | undefined;
}

export interface ServiceDefinition {
  name: string;
  file: string;
  methods: string[];
  evidence?: Evidence | undefined;
}

export interface JobDefinition {
  name: string;
  file: string;
  queue: string;
  evidence?: Evidence | undefined;
}

export interface MailerDefinition {
  name: string;
  file: string;
  actions: string[];
  evidence?: Evidence | undefined;
}

export interface AdminResourceDefinition {
  name: string;
  file: string;
  model: string;
  evidence?: Evidence | undefined;
}

export interface NextRouteDefinition {
  path: string;
  file: string;
  type: "page" | "route_handler" | "layout";
  evidence?: Evidence | undefined;
}

export interface TableDefinition {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable?: boolean | undefined;
    indexed?: boolean | undefined;
  }[];
  indexes: string[];
  evidence?: Evidence | undefined;
}

export interface MigrationDefinition {
  version: string;
  name: string;
  file: string;
  evidence?: Evidence | undefined;
}

export interface SpecDefinition {
  file: string;
  type: "model" | "request" | "policy" | "service" | "job" | "system" | "other";
  targetComponent?: string | undefined;
  evidence: Evidence;
}

export interface SecretFinding {
  file: string;
  line: number;
  variableName: string;
  type: "api_key" | "jwt_secret" | "stripe_secret" | "database_url" | "private_key";
  redactedValue: string;
}

export interface RepositoryManifest {
  manifestVersion: number;
  scannedAt: string;
  validation: RepositoryValidationResult;
  scanCoverage: ScanCoverage;
  repository: {
    path: string;
    name: string;
  };
  stack: {
    backend: "rails" | "node" | "go" | "python" | "unknown";
    frontend: "nextjs" | "react" | "vue" | "none" | "unknown";
    database: "postgres" | "mysql" | "sqlite" | "mongodb" | "unknown";
    postgis: boolean;
    queue: "sidekiq" | "redis" | "none" | "unknown";
    storage: "active_storage" | "s3" | "local" | "unknown";
  };
  versions: Record<string, string>;
  backend: {
    framework: string;
    routes: RouteDefinition[];
    models: ModelDefinition[];
    controllers: ControllerDefinition[];
    policies: PolicyDefinition[];
    services: ServiceDefinition[];
    jobs: JobDefinition[];
    mailers: MailerDefinition[];
    adminResources: AdminResourceDefinition[];
    initializers: string[];
  };
  frontend: {
    framework: string;
    appRouter: boolean;
    pagesRouter: boolean;
    routes: NextRouteDefinition[];
    components: string[];
    hooks: string[];
    uiLibrary: "shadcn" | "tailwind" | "mui" | "none" | "unknown";
    styling: string[];
  };
  database: {
    type: string;
    postgis: boolean;
    tables: TableDefinition[];
    migrations: MigrationDefinition[];
  };
  background_jobs: {
    runner: string;
    queues: string[];
    jobs: string[];
  };
  storage: {
    provider: string;
    activeStorage: boolean;
    s3Compatible: boolean;
  };
  auth: {
    mechanisms: string[];
    mfa: boolean;
    oauth: string[];
    apiKeys: boolean;
  };
  admin: {
    type: "active_admin" | "rails_admin" | "custom" | "none";
    resources: string[];
  };
  tests: {
    frameworks: string[];
    specCount: number;
    testPaths: string[];
    specs?: SpecDefinition[] | undefined;
  };
  infra: {
    docker: boolean;
    compose: boolean;
    githubActions: boolean;
    workflows: string[];
  };
  security: {
    secretFindings: SecretFinding[];
    unsafeFilesBlocked: string[];
  };
  unknowns: string[];
}

export interface ProductWorkspace {
  name: string;
  rootPath: string;
  validation: RepositoryValidationResult;
  backendRoots: string[];
  frontendRoots: string[];
  manifests: Record<string, RepositoryManifest>;
}
