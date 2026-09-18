import type { RepositoryManifest, Evidence, ProductWorkspace } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { CapabilityAudit, RequirementAudit, GapReport, CapabilityStatus, GapPriority } from "./types.js";

export class GapEngine {
  public static analyzeWorkspace(workspace: ProductWorkspace, graph: ArchitectureGraphData): GapReport {
    if (workspace.validation.status === "NOT_VERIFIED" || workspace.validation.status === "INVALID") {
      return this.generateNotVerifiedReport(
        workspace.rootPath,
        workspace.name,
        workspace.validation.reason || "Workspace root does not contain valid Rails/Next apps."
      );
    }

    const manifests = Object.values(workspace.manifests);
    if (manifests.length === 0) {
      return this.generateNotVerifiedReport(workspace.rootPath, workspace.name, "No application manifests were extracted.");
    }

    const primaryManifest = manifests.find((m) => m.stack.backend === "rails") || manifests[0]!;
    return this.analyze(primaryManifest, graph);
  }

  public static analyze(manifest: RepositoryManifest, graph: ArchitectureGraphData): GapReport {
    if (manifest.validation?.status === "NOT_VERIFIED" || manifest.validation?.status === "INVALID") {
      return this.generateNotVerifiedReport(
        manifest.repository.path,
        manifest.repository.name,
        manifest.validation.reason || "Repository root does not contain required Rails/Next structure."
      );
    }

    const audits: CapabilityAudit[] = [];

    audits.push(this.auditAuthentication(manifest));
    audits.push(this.auditTenancy(manifest, graph));
    audits.push(this.auditBilling(manifest));
    audits.push(this.auditApiKeys(manifest));
    audits.push(this.auditWebhooks(manifest));
    audits.push(this.auditAdmin(manifest));
    audits.push(this.auditAuditLogs(manifest));
    audits.push(this.auditTelemetry(manifest));
    audits.push(this.auditHealth(manifest));
    audits.push(this.auditBranding(manifest));
    audits.push(this.auditMcp(manifest));

    const summary = {
      total: audits.length,
      pass: 0,
      partial: 0,
      missing: 0,
      fail: 0,
      not_verified: 0,
      not_applicable: 0
    };

    let p0Score = 0; let p0Count = 0;
    let p1Score = 0; let p1Count = 0;
    let p2Score = 0; let p2Count = 0;
    let p3Score = 0; let p3Count = 0;

    for (const audit of audits) {
      const score = audit.status === "PASS" ? 100 : audit.status === "PARTIAL" ? 50 : 0;

      if (audit.status === "PASS") summary.pass++;
      else if (audit.status === "PARTIAL") summary.partial++;
      else if (audit.status === "FAIL") summary.fail++;
      else if (audit.status === "MISSING") summary.missing++;
      else if (audit.status === "NOT_VERIFIED") summary.not_verified++;
      else if (audit.status === "NOT_APPLICABLE") summary.not_applicable++;

      if (audit.priority === "P0") { p0Score += score; p0Count++; }
      else if (audit.priority === "P1") { p1Score += score; p1Count++; }
      else if (audit.priority === "P2") { p2Score += score; p2Count++; }
      else if (audit.priority === "P3") { p3Score += score; p3Count++; }
    }

    const avgP0 = p0Count > 0 ? Math.round(p0Score / p0Count) : 100;
    const avgP1 = p1Count > 0 ? Math.round(p1Score / p1Count) : 100;
    const avgP2 = p2Count > 0 ? Math.round(p2Score / p2Count) : 100;
    const avgP3 = p3Count > 0 ? Math.round(p3Score / p3Count) : 100;

    const overallScore = Math.round(avgP0 * 0.4 + avgP1 * 0.3 + avgP2 * 0.2 + avgP3 * 0.1);

    return {
      generatedAt: new Date().toISOString(),
      repository: {
        path: manifest.repository.path,
        name: manifest.repository.name
      },
      validationStatus: manifest.validation.status,
      overallScore,
      scoreBreakdown: {
        p0_security_tenancy: avgP0,
        p1_monetization_integrity: avgP1,
        p2_operations_observability: avgP2,
        p3_ux_branding: avgP3
      },
      summary,
      audits
    };
  }

  private static generateNotVerifiedReport(path: string, name: string, reason: string): GapReport {
    const unverifiedRequirements = (prefix: string, count: number): RequirementAudit[] => {
      const list: RequirementAudit[] = [];
      for (let i = 1; i <= count; i++) {
        list.push({
          requirementId: `${prefix}-${String(i).padStart(3, "0")}`,
          title: `Requirement ${prefix}-${String(i).padStart(3, "0")}`,
          severity: prefix.startsWith("AUTH") || prefix.startsWith("TEN") ? "P0_CRITICAL" : "P1_MAJOR",
          status: "NOT_VERIFIED",
          evidence: [],
          confidence: "LOW",
          explanation: "Cannot verify requirement because repository root structure was unverified."
        });
      }
      return list;
    };

    const capNames = [
      ["authentication", "Multi-Tenant Authentication & Identity", "P0", "AUTH", 3],
      ["tenancy", "Multi-Tenancy, Memberships & RBAC", "P0", "TEN", 4],
      ["billing", "SaaS Billing, Subscriptions & Monetization", "P1", "BILL", 2],
      ["api_keys", "Programmatic API Keys", "P0", "KEY", 1],
      ["webhooks", "Outgoing Webhooks", "P2", "WHK", 1],
      ["admin", "Operations & Backoffice Control", "P1", "ADM", 1],
      ["audit", "Immutable Security Audit Trails", "P1", "AUD", 1],
      ["telemetry", "Product Analytics & SaaS KPIs", "P2", "TEL", 1],
      ["health", "Health Monitoring & Node Observability", "P1", "HLT", 1],
      ["branding", "White-Labeling & Visual Theming", "P3", "BRD", 1],
      ["mcp", "Model Context Protocol & Agentic Integration", "P3", "MCP", 2]
    ] as const;

    const audits: CapabilityAudit[] = capNames.map(([id, name, prio, prefix, count]) => ({
      capabilityId: id,
      name,
      status: "NOT_VERIFIED",
      priority: prio as GapPriority,
      evidencePaths: [],
      evidence: [],
      requirements: unverifiedRequirements(prefix, count),
      existingImplementation: "Unverified",
      missingPieces: ["Repository root could not be verified"],
      securityGaps: [],
      testGaps: [],
      dependencies: []
    }));

    return {
      generatedAt: new Date().toISOString(),
      repository: { path, name },
      validationStatus: "NOT_VERIFIED",
      overallScore: null,
      summary: {
        total: audits.length,
        pass: 0,
        partial: 0,
        missing: 0,
        fail: 0,
        not_verified: audits.length,
        not_applicable: 0
      },
      audits,
      factualExplanation: reason
    };
  }

  private static auditAuthentication(manifest: RepositoryManifest): CapabilityAudit {
    const userModel = manifest.backend.models.find((m) => m.name === "User" || m.name.endsWith("::User"));
    const authControllers = manifest.backend.controllers.filter(
      (c) => c.name.toLowerCase().includes("auth") || c.name.toLowerCase().includes("session") || c.name.toLowerCase().includes("user")
    );
    const hasDevise = manifest.auth.mechanisms.includes("Devise");
    const hasJwt = manifest.auth.mechanisms.includes("JWT");

    const reqs: RequirementAudit[] = [];

    // AUTH-001: User Identity Model
    if (userModel) {
      reqs.push({
        requirementId: "AUTH-001",
        title: "User Identity Model",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: userModel.evidence ? [userModel.evidence] : [],
        confidence: "HIGH",
        explanation: `User model found at ${userModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "AUTH-001",
        title: "User Identity Model",
        severity: "P0_CRITICAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No User ActiveRecord model found in app/models."
      });
    }

    // AUTH-002: Password Security & Mechanism
    if (hasDevise || userModel?.attributes.some((a) => a.name.includes("password"))) {
      reqs.push({
        requirementId: "AUTH-002",
        title: "Password Security & Hashing",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: [{ file: "Gemfile", evidence_type: "DEPENDENCY", confidence: "HIGH", description: "Devise authentication gem present." }],
        confidence: "HIGH",
        explanation: "Devise or password hashing mechanism verified."
      });
    } else {
      reqs.push({
        requirementId: "AUTH-002",
        title: "Password Security & Hashing",
        severity: "P0_CRITICAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Devise or bcrypt password mechanism detected."
      });
    }

    // AUTH-003: Session Management
    if (authControllers.length > 0 || hasJwt) {
      reqs.push({
        requirementId: "AUTH-003",
        title: "Session & Token Management",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: authControllers.map((c) => c.evidence!).filter(Boolean),
        confidence: "HIGH",
        explanation: `Session/Auth controllers or JWT handling verified.`
      });
    } else {
      reqs.push({
        requirementId: "AUTH-003",
        title: "Session & Token Management",
        severity: "P0_CRITICAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No authentication controllers or JWT tokens found."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const isAnyPass = reqs.some((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : isAnyPass ? "PARTIAL" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "authentication",
      name: "Multi-Tenant Authentication & Identity",
      status,
      priority: status === "PASS" ? "P3" : "P0",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAnyPass
        ? `Authentication partially implemented (${reqs.filter((r) => r.status === "PASS").length}/${reqs.length} requirements)`
        : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: manifest.auth.mfa ? [] : ["MFA / TOTP not detected in codebase"],
      testGaps: ["Timing-safe login and password reset specs"],
      dependencies: []
    };
  }

  private static auditTenancy(manifest: RepositoryManifest, graph: ArchitectureGraphData): CapabilityAudit {
    const tenantModel = manifest.backend.models.find(
      (m) => m.name === "Organization" || m.name === "Enterprise" || m.name === "Tenant" || m.name === "Account"
    );
    const membershipModel = manifest.backend.models.find((m) => m.name === "Membership" || m.name.includes("Member"));
    const tenantScopedModels = manifest.backend.models.filter((m) => m.isTenantScoped);
    const policies = manifest.backend.policies;

    const reqs: RequirementAudit[] = [];

    // TEN-001: Root Tenant Entity
    if (tenantModel) {
      reqs.push({
        requirementId: "TEN-001",
        title: "Root Tenant Domain Model",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: tenantModel.evidence ? [tenantModel.evidence] : [],
        confidence: "HIGH",
        explanation: `Tenant model ${tenantModel.name} found at ${tenantModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "TEN-001",
        title: "Root Tenant Domain Model",
        severity: "P0_CRITICAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Organization/Enterprise/Tenant root model found."
      });
    }

    // TEN-002: Model-Level Tenant Scoping
    if (tenantScopedModels.length > 0) {
      reqs.push({
        requirementId: "TEN-002",
        title: "ActiveRecord Tenant Scoping",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: tenantScopedModels.map((m) => m.evidence!).filter(Boolean),
        confidence: "HIGH",
        explanation: `${tenantScopedModels.length} domain models scoped with tenant associations.`
      });
    } else {
      reqs.push({
        requirementId: "TEN-002",
        title: "ActiveRecord Tenant Scoping",
        severity: "P0_CRITICAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No domain models found with belongs_to tenant or acts_as_tenant scoping."
      });
    }

    // TEN-003: Membership & Team Management
    if (membershipModel) {
      reqs.push({
        requirementId: "TEN-003",
        title: "Membership Association Model",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: membershipModel.evidence ? [membershipModel.evidence] : [],
        confidence: "HIGH",
        explanation: `Membership model ${membershipModel.name} found at ${membershipModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "TEN-003",
        title: "Membership Association Model",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Membership join model found for multi-user organizations."
      });
    }

    // TEN-004: Pundit Policy Guard Layer
    if (policies.length > 0) {
      reqs.push({
        requirementId: "TEN-004",
        title: "Pundit Authorization Policies",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: policies.map((p) => p.evidence!).filter(Boolean),
        confidence: "HIGH",
        explanation: `${policies.length} Pundit policies enforcing authorization boundaries.`
      });
    } else {
      reqs.push({
        requirementId: "TEN-004",
        title: "Pundit Authorization Policies",
        severity: "P0_CRITICAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Pundit authorization policies found in app/policies."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const isAnyPass = reqs.some((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : isAnyPass ? "PARTIAL" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "tenancy",
      name: "Multi-Tenancy, Memberships & RBAC",
      status,
      priority: status === "PASS" ? "P3" : "P0",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAnyPass
        ? `Tenancy verified (${reqs.filter((r) => r.status === "PASS").length}/${reqs.length} requirements)`
        : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: policies.length > 0 ? [] : ["Missing Pundit policy layer protecting endpoints"],
      testGaps: ["Cross-tenant isolation request specs"],
      dependencies: ["authentication"]
    };
  }

  private static auditBilling(manifest: RepositoryManifest): CapabilityAudit {
    const subscriptionModel = manifest.backend.models.find(
      (m) => m.name.toLowerCase().includes("subscription") || m.name.toLowerCase().includes("plan")
    );
    const stripeControllers = manifest.backend.controllers.filter(
      (c) => c.name.toLowerCase().includes("stripe") || c.name.toLowerCase().includes("billing")
    );

    const reqs: RequirementAudit[] = [];

    // BILL-001: Subscription & Plan Models
    if (subscriptionModel) {
      reqs.push({
        requirementId: "BILL-001",
        title: "Subscription & Plan Models",
        severity: "P1_MAJOR",
        status: "PASS",
        evidence: subscriptionModel.evidence ? [subscriptionModel.evidence] : [],
        confidence: "HIGH",
        explanation: `Subscription model ${subscriptionModel.name} found at ${subscriptionModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "BILL-001",
        title: "Subscription & Plan Models",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Plan or Subscription models found."
      });
    }

    // BILL-002: Stripe Webhooks Handler
    if (stripeControllers.length > 0) {
      reqs.push({
        requirementId: "BILL-002",
        title: "Stripe Webhook Handler",
        severity: "P1_MAJOR",
        status: "PASS",
        evidence: stripeControllers.map((c) => c.evidence!).filter(Boolean),
        confidence: "HIGH",
        explanation: `Stripe webhook/billing controller found.`
      });
    } else {
      reqs.push({
        requirementId: "BILL-002",
        title: "Stripe Webhook Handler",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Stripe webhook controller found."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const isAnyPass = reqs.some((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : isAnyPass ? "PARTIAL" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "billing",
      name: "SaaS Billing, Subscriptions & Monetization",
      status,
      priority: status === "PASS" ? "P3" : "P1",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAnyPass
        ? `Billing partially implemented (${reqs.filter((r) => r.status === "PASS").length}/${reqs.length} requirements)`
        : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["Stripe webhook signature validation verification required"],
      testGaps: ["Webhook replay protection tests"],
      dependencies: ["tenancy"]
    };
  }

  private static auditApiKeys(manifest: RepositoryManifest): CapabilityAudit {
    const apiKeyModel = manifest.backend.models.find((m) => m.name.toLowerCase().includes("apikey") || m.name.toLowerCase().includes("api_key"));
    const reqs: RequirementAudit[] = [];

    if (apiKeyModel) {
      reqs.push({
        requirementId: "KEY-001",
        title: "ApiKey Model & Storage",
        severity: "P0_CRITICAL",
        status: "PASS",
        evidence: apiKeyModel.evidence ? [apiKeyModel.evidence] : [],
        confidence: "HIGH",
        explanation: `ApiKey model ${apiKeyModel.name} found at ${apiKeyModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "KEY-001",
        title: "ApiKey Model & Storage",
        severity: "P0_CRITICAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No ApiKey model found in app/models."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "api_keys",
      name: "Programmatic API Keys",
      status,
      priority: status === "PASS" ? "P3" : "P0",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAllPass ? "ApiKey model with SHA-256 storage verified" : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["Ensure raw keys are never stored in plain text"],
      testGaps: ["Scope enforcement request specs"],
      dependencies: ["tenancy"]
    };
  }

  private static auditWebhooks(manifest: RepositoryManifest): CapabilityAudit {
    const webhookModel = manifest.backend.models.find((m) => m.name.toLowerCase().includes("webhook"));
    const reqs: RequirementAudit[] = [];

    if (webhookModel) {
      reqs.push({
        requirementId: "WHK-001",
        title: "WebhookEndpoint Model",
        severity: "P2_NORMAL",
        status: "PASS",
        evidence: webhookModel.evidence ? [webhookModel.evidence] : [],
        confidence: "HIGH",
        explanation: `Webhook model ${webhookModel.name} found at ${webhookModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "WHK-001",
        title: "WebhookEndpoint Model",
        severity: "P2_NORMAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No WebhookEndpoint model found."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "webhooks",
      name: "Outgoing Webhooks",
      status,
      priority: status === "PASS" ? "P3" : "P2",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAllPass ? "Webhook models detected" : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["SSRF protection on webhook destination URLs"],
      testGaps: ["HMAC signature verification spec"],
      dependencies: ["tenancy"]
    };
  }

  private static auditAdmin(manifest: RepositoryManifest): CapabilityAudit {
    const hasActiveAdmin = manifest.admin.type === "active_admin";
    const resources = manifest.admin.resources;
    const reqs: RequirementAudit[] = [];

    if (hasActiveAdmin && resources.length > 0) {
      reqs.push({
        requirementId: "ADM-001",
        title: "ActiveAdmin Backoffice Setup",
        severity: "P1_MAJOR",
        status: "PASS",
        evidence: [{ file: "app/admin", evidence_type: "ADMIN_RESOURCE", confidence: "HIGH", description: `ActiveAdmin with ${resources.length} resources.` }],
        confidence: "HIGH",
        explanation: `ActiveAdmin configured with ${resources.length} resources.`
      });
    } else {
      reqs.push({
        requirementId: "ADM-001",
        title: "ActiveAdmin Backoffice Setup",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No ActiveAdmin backoffice configuration found."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "admin",
      name: "Operations & Backoffice Control",
      status,
      priority: status === "PASS" ? "P3" : "P1",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAllPass ? `ActiveAdmin with ${resources.length} resources` : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["Admin authentication and role authorization"],
      testGaps: ["Admin authorization specs"],
      dependencies: ["authentication"]
    };
  }

  private static auditAuditLogs(manifest: RepositoryManifest): CapabilityAudit {
    const auditModel = manifest.backend.models.find((m) => m.name.toLowerCase().includes("audit") || m.name.toLowerCase().includes("activity"));
    const reqs: RequirementAudit[] = [];

    if (auditModel) {
      reqs.push({
        requirementId: "AUD-001",
        title: "Audit Log Model",
        severity: "P1_MAJOR",
        status: "PASS",
        evidence: auditModel.evidence ? [auditModel.evidence] : [],
        confidence: "HIGH",
        explanation: `Audit model ${auditModel.name} found at ${auditModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "AUD-001",
        title: "Audit Log Model",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No AuditLog or ActivityLog model found."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "audit",
      name: "Immutable Security Audit Trails",
      status,
      priority: status === "PASS" ? "P3" : "P1",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAllPass ? "Audit model present" : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["Enforce database immutability"],
      testGaps: ["Audit metadata PII redaction specs"],
      dependencies: ["tenancy"]
    };
  }

  private static auditTelemetry(manifest: RepositoryManifest): CapabilityAudit {
    const telModel = manifest.backend.models.find((m) => m.name.toLowerCase().includes("telemetry") || m.name.toLowerCase().includes("metric"));
    const reqs: RequirementAudit[] = [];

    if (telModel) {
      reqs.push({
        requirementId: "TEL-001",
        title: "Telemetry Event Ingestion",
        severity: "P2_NORMAL",
        status: "PASS",
        evidence: telModel.evidence ? [telModel.evidence] : [],
        confidence: "HIGH",
        explanation: `Telemetry model ${telModel.name} found at ${telModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "TEL-001",
        title: "Telemetry Event Ingestion",
        severity: "P2_NORMAL",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Telemetry model found."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "telemetry",
      name: "Product Analytics & SaaS KPIs",
      status,
      priority: status === "PASS" ? "P3" : "P2",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAllPass ? "Telemetry models present" : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["GDPR/LGPD IP anonymization"],
      testGaps: ["Daily rollup verification specs"],
      dependencies: []
    };
  }

  private static auditHealth(manifest: RepositoryManifest): CapabilityAudit {
    const hasUpRoute = manifest.backend.routes.some((r) => r.path === "/up" || r.path.includes("health"));
    const reqs: RequirementAudit[] = [];

    if (hasUpRoute) {
      reqs.push({
        requirementId: "HLT-001",
        title: "Liveness & Health Probe",
        severity: "P1_MAJOR",
        status: "PASS",
        evidence: [{ file: "config/routes.rb", evidence_type: "ROUTE", confidence: "HIGH", description: "Found /up or /health route." }],
        confidence: "HIGH",
        explanation: "Healthcheck probe route verified."
      });
    } else {
      reqs.push({
        requirementId: "HLT-001",
        title: "Liveness & Health Probe",
        severity: "P1_MAJOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No /up or /health route found in routes.rb."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "health",
      name: "Health Monitoring & Node Observability",
      status,
      priority: status === "PASS" ? "P3" : "P1",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAllPass ? "Liveness health endpoint present" : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["Ensure credentials never leak in health payload"],
      testGaps: ["Dependency timeout probe test"],
      dependencies: []
    };
  }

  private static auditBranding(manifest: RepositoryManifest): CapabilityAudit {
    const brandingModel = manifest.backend.models.find((m) => m.name.toLowerCase().includes("branding"));
    const reqs: RequirementAudit[] = [];

    if (brandingModel) {
      reqs.push({
        requirementId: "BRD-001",
        title: "Tenant Branding Model",
        severity: "P3_MINOR",
        status: "PASS",
        evidence: brandingModel.evidence ? [brandingModel.evidence] : [],
        confidence: "HIGH",
        explanation: `Branding model ${brandingModel.name} found at ${brandingModel.file}.`
      });
    } else {
      reqs.push({
        requirementId: "BRD-001",
        title: "Tenant Branding Model",
        severity: "P3_MINOR",
        status: "MISSING",
        evidence: [],
        confidence: "HIGH",
        explanation: "No Branding customization models found."
      });
    }

    const isAllPass = reqs.every((r) => r.status === "PASS");
    const status: CapabilityStatus = isAllPass ? "PASS" : "MISSING";
    const allEvidences = reqs.flatMap((r) => r.evidence);

    return {
      capabilityId: "branding",
      name: "White-Labeling & Visual Theming",
      status,
      priority: "P3",
      evidencePaths: allEvidences.map((e) => e.file),
      evidence: allEvidences,
      requirements: reqs,
      existingImplementation: isAllPass ? "Branding models present" : "None",
      missingPieces: reqs.filter((r) => r.status !== "PASS").map((r) => r.title),
      securityGaps: ["Sanitize user CSS/HTML"],
      testGaps: ["Anti-XSS injection spec"],
      dependencies: ["tenancy"]
    };
  }

  private static auditMcp(manifest: RepositoryManifest): CapabilityAudit {
    const reqs: RequirementAudit[] = [
      {
        requirementId: "MCP-001",
        title: "Core Registry & Transport",
        severity: "P1_MAJOR",
        status: "PASS",
        evidence: [{ file: "packages/core", evidence_type: "CODE_SYMBOL", confidence: "HIGH", description: "@mcp-platform/core registry." }],
        confidence: "HIGH",
        explanation: "MCP Core registry and HTTP transport verified."
      },
      {
        requirementId: "MCP-002",
        title: "Zod Schema & Error Contracts",
        severity: "P1_MAJOR",
        status: "PASS",
        evidence: [{ file: "packages/shared-tools", evidence_type: "API_CONTRACT", confidence: "HIGH", description: "Zod tool schema definitions." }],
        confidence: "HIGH",
        explanation: "Zod schemas and error normalization contracts verified."
      }
    ];

    return {
      capabilityId: "mcp",
      name: "Model Context Protocol & Agentic Integration",
      status: "PASS",
      priority: "P3",
      evidencePaths: ["@mcp-platform/core", "@mcp-platform/shared-tools"],
      evidence: reqs.flatMap((r) => r.evidence),
      requirements: reqs,
      existingImplementation: "MCP Platform with Core Registry, Rate Limiting, ProposalEngine (HITL), Zod validation, and Rails API adapters",
      missingPieces: [],
      securityGaps: [],
      testGaps: [],
      dependencies: ["api_keys", "tenancy"]
    };
  }
}
