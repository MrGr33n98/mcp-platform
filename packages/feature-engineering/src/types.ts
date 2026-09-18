import type { Evidence } from "@mcp-platform/repository-intelligence";
import type { RequirementAudit } from "@mcp-platform/saas-gap-analyzer";

export type FeatureEngineeringMode = "PLAN_ONLY" | "DRY_RUN";

export interface JobPattern {
  baseClass: string;
  queueName: string;
  retryPolicy: string;
  errorHandling: string;
  loggingPattern: string;
}

export interface ServicePattern {
  patternType: "CALL_METHOD" | "RESULT_OBJECT" | "APPLICATION_SERVICE";
  baseClass?: string | undefined;
  namespaceConvention: string;
  methodSignature: string;
}

export interface ControllerPattern {
  apiBaseClass: string;
  authMethod: string;
  errorHandling: string;
  paramsConvention: string;
  responseSerializer: string;
}

export interface PolicyPattern {
  framework: "PUNDIT" | "ACTION_POLICY" | "CAN_CAN_CAN" | "CUSTOM";
  baseClass: string;
  tenancyScopePattern: string;
}

export interface ModelPattern {
  tenancyAssociation: string;
  tenantKey: string;
  idType: "uuid" | "bigint" | "integer";
  encryptionHelper: "ActiveRecord::Encryption" | "attr_encrypted" | "none";
  timestamps: boolean;
}

export interface MigrationPattern {
  railsVersion: string;
  uuidPrimaryKey: boolean;
  foreignKeyConstraints: boolean;
  indexesConvention: boolean;
}

export interface TestPattern {
  framework: "rspec" | "minitest";
  specTypes: {
    model: boolean;
    request: boolean;
    policy: boolean;
    job: boolean;
    service: boolean;
  };
  authHeaderHelper: string;
  factoryPattern: "factory_bot" | "fixtures" | "none";
}

export interface AdminPattern {
  framework: "active_admin" | "rails_admin" | "custom" | "none";
  resourcePath: string;
}

export interface FrontendPattern {
  framework: "next_app_router" | "next_pages_router" | "none";
  apiClient: string;
  authStorage: string;
}

export interface CodePattern {
  jobs: JobPattern;
  services: ServicePattern;
  controllers: ControllerPattern;
  policies: PolicyPattern;
  models: ModelPattern;
  migrations: MigrationPattern;
  tests: TestPattern;
  admin: AdminPattern;
  frontend: FrontendPattern;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  null?: boolean | undefined;
  default?: unknown | undefined;
  index?: boolean | undefined;
  unique?: boolean | undefined;
  comment?: string | undefined;
}

export interface ForeignKeyDefinition {
  column: string;
  toTable: string;
  primaryKey?: string | undefined;
  onDelete?: "cascade" | "nullify" | "restrict" | undefined;
}

export interface IndexDefinition {
  columns: string[];
  unique?: boolean | undefined;
  name?: string | undefined;
  where?: string | undefined;
}

export interface DatabaseChangePlan {
  table: string;
  operation: "CREATE_TABLE" | "ADD_COLUMN" | "ADD_INDEX" | "ADD_FOREIGN_KEY";
  columns: ColumnDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
  upSql?: string | undefined;
  downSql?: string | undefined;
}

export interface MigrationPlan {
  migrationName: string;
  versionTag: string;
  filename: string;
  targetPath: string;
  rubyCode: string;
  changes: DatabaseChangePlan[];
  reversible: boolean;
}

export interface RollbackStep {
  stepNumber: number;
  name: string;
  description: string;
  command?: string | undefined;
  rubyCode?: string | undefined;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface RollbackPlan {
  strategy: "MIGRATION_DOWN" | "TABLE_DROP" | "FILE_RESTORE";
  steps: RollbackStep[];
  dataLossRisk: string;
  safeRollbackGuaranteed: boolean;
}

export interface ModelPlan {
  name: string;
  className: string;
  filePath: string;
  tableName: string;
  belongsToTenancy: string;
  associations: string[];
  validations: string[];
  scopes: string[];
  encryptedAttributes?: string[] | undefined;
  codePreview: string;
}

export interface PolicyActionRule {
  action: string;
  allowedRoles: string[];
  ruleDescription: string;
}

export interface PolicyPlan {
  name: string;
  className: string;
  filePath: string;
  modelName: string;
  actions: PolicyActionRule[];
  scopeDefinition: string;
  codePreview: string;
}

export interface ServicePlan {
  name: string;
  className: string;
  filePath: string;
  responsibility: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  errorHandling: string;
  codePreview: string;
}

export interface JobPlan {
  name: string;
  className: string;
  filePath: string;
  queue: string;
  retryPolicy: string;
  timeoutSeconds: number;
  parameters: Record<string, string>;
  codePreview: string;
}

export interface ControllerActionPlan {
  name: string;
  httpMethod: string;
  path: string;
  policyCheck: string;
  description: string;
}

export interface ControllerPlan {
  name: string;
  className: string;
  filePath: string;
  baseClass: string;
  actions: ControllerActionPlan[];
  codePreview: string;
}

export interface RoutePlan {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  controller: string;
  action: string;
  routeCodeSnippet: string;
}

export interface APIStatusCodePlan {
  code: number;
  description: string;
}

export interface APIContractPlan {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  statusCodes: APIStatusCodePlan[];
}

export interface ActiveAdminPlan {
  resourceName: string;
  filePath: string;
  menuPriority: number;
  permittedParams: string[];
  codePreview: string;
}

export interface FrontendComponentPlan {
  name: string;
  filePath: string;
  description: string;
}

export interface FrontendPlan {
  pagePath: string;
  filePath: string;
  components: FrontendComponentPlan[];
  description: string;
}

export interface TestCasePlan {
  name: string;
  assertion: string;
  protectsAgainst: string;
}

export interface TestPlan {
  category:
    | "MODEL_SPEC"
    | "REQUEST_SPEC"
    | "POLICY_SPEC"
    | "SERVICE_SPEC"
    | "JOB_SPEC"
    | "CROSS_TENANT_SPEC"
    | "FAILURE_MODE_SPEC";
  filePath: string;
  description: string;
  testCases: TestCasePlan[];
  codePreview: string;
}

export interface SecurityCheckPlan {
  ruleId: string;
  name: string;
  category:
    | "AUTHENTICATION"
    | "TENANCY_ISOLATION"
    | "SECRET_STORAGE"
    | "SSRF_PREVENTION"
    | "RATE_LIMITING"
    | "RBAC_ENFORCEMENT";
  mitigationStrategy: string;
  automatedVerification: string;
}

export interface VerificationCheck {
  id: string;
  name: string;
  command: string;
  expectedOutput: string;
  severity: "BLOCKING" | "WARNING";
}

export interface VerificationPlan {
  preConditions: string[];
  checks: VerificationCheck[];
  postConditions: string[];
}

export interface VerticalSlicePlan {
  capability: string;
  title: string;
  description: string;
  requirements: RequirementAudit[];
  currentEvidence: Evidence[];
  gaps: string[];
  affectedComponents: string[];
  existingPatterns: CodePattern;
  databaseChanges: DatabaseChangePlan[];
  models: ModelPlan[];
  policies: PolicyPlan[];
  services: ServicePlan[];
  jobs: JobPlan[];
  controllers: ControllerPlan[];
  routes: RoutePlan[];
  apiContracts: APIContractPlan[];
  activeAdmin: ActiveAdminPlan[];
  frontendChanges: FrontendPlan[];
  tests: TestPlan[];
  securityChecks: SecurityCheckPlan[];
  migrationPlan: MigrationPlan;
  rollbackPlan: RollbackPlan;
  verificationPlan: VerificationPlan;
  risks: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
}

export interface ChangeOperation {
  id: string;
  type: "CREATE_FILE" | "MODIFY_FILE" | "RUN_MIGRATION" | "REGISTER_ROUTE" | "ADD_ACTIVE_ADMIN";
  path: string;
  description: string;
  patternApplied: string;
  codePreview?: string | undefined;
  evidenceOrigin?: string | undefined;
}

export interface ChangePlanVerificationStep {
  step: number;
  name: string;
  command: string;
  expected: string;
}

export interface ChangePlanRollbackStep {
  step: number;
  name: string;
  action: string;
}

export interface ChangePlan {
  schema_version: 1;
  mode: "PLAN_ONLY";
  product: string;
  capability: string;
  operations: ChangeOperation[];
  verification: ChangePlanVerificationStep[];
  rollback: ChangePlanRollbackStep[];
  approval_required: true;
}

export interface FeatureEngineeringOptions {
  mode?: FeatureEngineeringMode | undefined;
  productName?: string | undefined;
  targetCapability?: string | undefined;
}
