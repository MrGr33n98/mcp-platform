import type { CapabilityAudit, RequirementAudit } from "@mcp-platform/saas-gap-analyzer";
import type { CodePattern } from "./types.js";

export interface ResolvedCapabilityDefinition {
  id: string;
  name: string;
  category: string;
  domainObjects: string[];
  securityRequirements: {
    tenantScoped: boolean;
    signedPayload?: boolean | undefined;
    hmacAlgorithm?: string | undefined;
    encryptedSecretStorage?: boolean | undefined;
    ssrfProtection?: boolean | undefined;
    rateLimiting?: boolean | undefined;
    rbacEnforced: boolean;
  };
  tables: string[];
  models: string[];
  policies: string[];
  services: string[];
  jobs: string[];
  controllers: string[];
  routes: Array<{ method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; action: string }>;
  adminResources: string[];
  frontendPages: string[];
  requiredTestCategories: Array<
    | "MODEL_SPEC"
    | "REQUEST_SPEC"
    | "POLICY_SPEC"
    | "SERVICE_SPEC"
    | "JOB_SPEC"
    | "CROSS_TENANT_SPEC"
    | "FAILURE_MODE_SPEC"
  >;
}

export class RequirementResolver {
  public static resolve(
    capabilityAudit: CapabilityAudit,
    _pattern: CodePattern
  ): {
    definition: ResolvedCapabilityDefinition;
    requirements: RequirementAudit[];
    unresolvedGaps: string[];
  } {
    const capId = capabilityAudit.capabilityId.toLowerCase();

    if (capId.includes("webhook")) {
      return this.resolveOutgoingWebhooks(capabilityAudit);
    }

    if (capId.includes("api_key") || capId.includes("apikey")) {
      return this.resolveApiKeys(capabilityAudit);
    }

    if (capId.includes("audit")) {
      return this.resolveAuditLogs(capabilityAudit);
    }

    // Default fallback capability resolver
    return this.resolveGenericCapability(capabilityAudit);
  }

  private static resolveOutgoingWebhooks(audit: CapabilityAudit) {
    const definition: ResolvedCapabilityDefinition = {
      id: "webhooks",
      name: "Outgoing Webhooks",
      category: "INTEGRATION",
      domainObjects: ["WebhookEndpoint", "WebhookDelivery", "WebhookAttempt"],
      securityRequirements: {
        tenantScoped: true,
        signedPayload: true,
        hmacAlgorithm: "sha256",
        encryptedSecretStorage: true,
        ssrfProtection: true,
        rateLimiting: true,
        rbacEnforced: true
      },
      tables: ["webhook_endpoints", "webhook_deliveries", "webhook_attempts"],
      models: ["WebhookEndpoint", "WebhookDelivery", "WebhookAttempt"],
      policies: ["WebhookEndpointPolicy"],
      services: ["Webhooks::DispatchService", "Webhooks::HmacSignerService", "Webhooks::SsrfValidatorService"],
      jobs: ["Webhooks::DeliverPayloadJob"],
      controllers: ["Api::V1::Developer::WebhooksController", "Api::V1::Developer::WebhookDeliveriesController"],
      routes: [
        { method: "GET", path: "/api/v1/developer/webhooks", action: "index" },
        { method: "POST", path: "/api/v1/developer/webhooks", action: "create" },
        { method: "PATCH", path: "/api/v1/developer/webhooks/:id", action: "update" },
        { method: "DELETE", path: "/api/v1/developer/webhooks/:id", action: "destroy" },
        { method: "POST", path: "/api/v1/developer/webhooks/:id/test", action: "test_delivery" },
        { method: "GET", path: "/api/v1/developer/webhooks/:id/deliveries", action: "deliveries" }
      ],
      adminResources: ["WebhookEndpoint", "WebhookDelivery"],
      frontendPages: ["/settings/developer"],
      requiredTestCategories: [
        "MODEL_SPEC",
        "REQUEST_SPEC",
        "POLICY_SPEC",
        "SERVICE_SPEC",
        "JOB_SPEC",
        "CROSS_TENANT_SPEC",
        "FAILURE_MODE_SPEC"
      ]
    };

    const requirements: RequirementAudit[] = [
      {
        requirementId: "WHK-001",
        title: "Webhook Domain Models & Tenant Scoping",
        severity: "P2_NORMAL",
        status: audit.status,
        evidence: audit.evidence,
        confidence: "HIGH",
        explanation: "WebhookEndpoint, WebhookDelivery, and WebhookAttempt models with organization isolation."
      },
      {
        requirementId: "WHK-002",
        title: "HMAC-SHA256 Payload Signing & Secret Encryption",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "Cryptographic signing of outgoing payloads and AES-GCM encryption of endpoint secrets at rest."
      },
      {
        requirementId: "WHK-003",
        title: "Asynchronous Background Delivery with Exponential Retries & SSRF Filter",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "Sidekiq background job with 10s timeout, exponential backoff, and local IP blocking."
      },
      {
        requirementId: "WHK-004",
        title: "Developer REST API Endpoints with Pundit Authorization",
        severity: "P2_NORMAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "CRUD endpoints under /api/v1/developer/webhooks with strict tenant scoping."
      },
      {
        requirementId: "WHK-005",
        title: "Automated Test Matrix & Cross-Tenant Isolation Proof",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "Comprehensive test suite covering models, requests, jobs, SSRF security, and cross-tenant boundaries."
      }
    ];

    const unresolvedGaps = [
      "No database tables for webhook_endpoints, webhook_deliveries, or webhook_attempts",
      "No Webhooks::DeliverPayloadJob with SSRF protection and retry logic",
      "No developer endpoints for webhook subscription management",
      "No Pundit authorization policy for webhook resources",
      "No automated specs protecting webhook operations"
    ];

    return { definition, requirements, unresolvedGaps };
  }

  private static resolveApiKeys(audit: CapabilityAudit) {
    const definition: ResolvedCapabilityDefinition = {
      id: "api_keys",
      name: "Programmatic API Keys",
      category: "AUTHENTICATION",
      domainObjects: ["ApiKey"],
      securityRequirements: {
        tenantScoped: true,
        signedPayload: false,
        encryptedSecretStorage: true,
        rbacEnforced: true
      },
      tables: ["api_keys"],
      models: ["ApiKey"],
      policies: ["ApiKeyPolicy"],
      services: ["ApiKeys::GeneratorService", "ApiKeys::AuthenticatorService"],
      jobs: ["ApiKeys::UpdateLastUsedJob"],
      controllers: ["Api::V1::Developer::ApiKeysController"],
      routes: [
        { method: "GET", path: "/api/v1/developer/api_keys", action: "index" },
        { method: "POST", path: "/api/v1/developer/api_keys", action: "create" },
        { method: "DELETE", path: "/api/v1/developer/api_keys/:id", action: "destroy" }
      ],
      adminResources: ["ApiKey"],
      frontendPages: ["/settings/developer"],
      requiredTestCategories: ["MODEL_SPEC", "REQUEST_SPEC", "POLICY_SPEC", "CROSS_TENANT_SPEC"]
    };

    const requirements: RequirementAudit[] = [
      {
        requirementId: "AUTH-003",
        title: "Programmatic API Keys with SHA-256 Storage",
        severity: "P0_CRITICAL",
        status: audit.status,
        evidence: audit.evidence,
        confidence: "HIGH",
        explanation: "API keys with zero plaintext storage and SHA-256 hashing."
      }
    ];

    return { definition, requirements, unresolvedGaps: audit.missingPieces };
  }

  private static resolveAuditLogs(audit: CapabilityAudit) {
    const definition: ResolvedCapabilityDefinition = {
      id: "audit_logs",
      name: "Audit & Compliance Logs",
      category: "OPERATIONS",
      domainObjects: ["AuditLog"],
      securityRequirements: {
        tenantScoped: true,
        rbacEnforced: true
      },
      tables: ["audit_logs"],
      models: ["AuditLog"],
      policies: ["AuditLogPolicy"],
      services: ["AuditLogs::RecorderService"],
      jobs: ["AuditLogs::BatchFlushJob"],
      controllers: ["Api::V1::Admin::AuditLogsController"],
      routes: [{ method: "GET", path: "/api/v1/admin/audit_logs", action: "index" }],
      adminResources: ["AuditLog"],
      frontendPages: ["/settings/audit"],
      requiredTestCategories: ["MODEL_SPEC", "REQUEST_SPEC", "POLICY_SPEC"]
    };

    const requirements: RequirementAudit[] = [
      {
        requirementId: "AUD-001",
        title: "Immutable Audit Log Storage",
        severity: "P2_NORMAL",
        status: audit.status,
        evidence: audit.evidence,
        confidence: "HIGH",
        explanation: "Structured immutable event logs capturing actor, action, tenant, and IP."
      }
    ];

    return { definition, requirements, unresolvedGaps: audit.missingPieces };
  }

  private static resolveGenericCapability(audit: CapabilityAudit) {
    const capName = audit.name.replace(/\s+/g, "");
    const definition: ResolvedCapabilityDefinition = {
      id: audit.capabilityId,
      name: audit.name,
      category: "FEATURE",
      domainObjects: [capName],
      securityRequirements: {
        tenantScoped: true,
        rbacEnforced: true
      },
      tables: [audit.capabilityId.toLowerCase()],
      models: [capName],
      policies: [`${capName}Policy`],
      services: [`${capName}Service`],
      jobs: [],
      controllers: [`Api::V1::${capName}Controller`],
      routes: [
        { method: "GET", path: `/api/v1/${audit.capabilityId}`, action: "index" },
        { method: "POST", path: `/api/v1/${audit.capabilityId}`, action: "create" }
      ],
      adminResources: [capName],
      frontendPages: [`/${audit.capabilityId}`],
      requiredTestCategories: ["MODEL_SPEC", "REQUEST_SPEC", "POLICY_SPEC", "CROSS_TENANT_SPEC"]
    };

    return {
      definition,
      requirements: audit.requirements,
      unresolvedGaps: audit.missingPieces
    };
  }
}
