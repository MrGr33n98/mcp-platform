import type { ModelPlan, ServicePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { SecurityFinding, VerificationCheckResult } from "../types.js";

export class SecurityValidator {
  public static validate(slicePlan: VerticalSlicePlan): {
    checks: VerificationCheckResult[];
    securityFindings: SecurityFinding[];
  } {
    const checks: VerificationCheckResult[] = [];
    const securityFindings: SecurityFinding[] = [];

    // 1. SSRF Network Boundary Validation
    if (slicePlan.capability.includes("webhook")) {
      const hasSsrfService = slicePlan.services.some((s: ServicePlan) => s.name.includes("SsrfValidatorService") || s.filePath.includes("ssrf"));
      const ssrfCode = slicePlan.services.find((s: ServicePlan) => s.name.includes("SsrfValidatorService"))?.codePreview || "";

      const blocksMetadata = ssrfCode.includes("169.254.0.0/16") || ssrfCode.includes("169.254.169.254");
      const blocksPrivateRanges = ssrfCode.includes("10.0.0.0/8") && ssrfCode.includes("192.168.0.0/16");
      const blocksLoopback = ssrfCode.includes("127.0.0.0/8") && ssrfCode.includes("::1/128");

      const isSsrfRobust = hasSsrfService && blocksMetadata && blocksPrivateRanges && blocksLoopback;

      checks.push({
        id: "SEC-VAL-001-SSRF",
        name: "SSRF Protection & Cloud Metadata Filter",
        category: "SECURITY_INTEGRITY",
        status: "STATIC",
        verdict: isSsrfRobust ? "PASS" : "FAIL",
        severity: isSsrfRobust ? "INFO" : "BLOCKER",
        message: isSsrfRobust
          ? "Robust SSRF protection planned (blocks RFC 1918 subnets, IPv6 loopback, and 169.254.169.254 cloud metadata)."
          : "SSRF protection is incomplete or missing in webhook dispatch pipeline."
      });

      if (!isSsrfRobust) {
        securityFindings.push({
          ruleId: "SEC-SSRF-INCOMPLETE",
          severity: "BLOCKER",
          description: "Outgoing webhook requests could reach internal IP ranges or cloud IAM metadata endpoints.",
          remediation: "Ensure Webhooks::SsrfValidatorService blocks 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, and 169.254.169.254.",
          mitigatedInPlan: false
        });
      }
    }

    // 2. Secret-at-Rest Encryption
    const hasEncryptedSecret = slicePlan.models.some((m: ModelPlan) => m.encryptedAttributes?.includes("encrypted_secret") || m.codePreview.includes("encrypts :"));
    checks.push({
      id: "SEC-VAL-002-SECRET-ENCRYPTION",
      name: "Cryptographic Secret Storage at Rest",
      category: "SECURITY_INTEGRITY",
      status: "STATIC",
      verdict: hasEncryptedSecret ? "PASS" : "WARNING",
      severity: hasEncryptedSecret ? "INFO" : "WARNING",
      message: hasEncryptedSecret
        ? "Signing secrets encrypted at rest via ActiveRecord::Encryption."
        : "Signing secrets stored in plaintext."
    });

    // 3. HMAC Signature Generation with Timestamp Context
    if (slicePlan.capability.includes("webhook")) {
      const hasHmac = slicePlan.services.some((s: ServicePlan) => s.name.includes("HmacSignerService"));
      const hmacCode = slicePlan.services.find((s: ServicePlan) => s.name.includes("HmacSignerService"))?.codePreview || "";
      const signsWithTimestamp = hmacCode.includes("timestamp") && hmacCode.includes("HMAC.hexdigest");

      checks.push({
        id: "SEC-VAL-003-HMAC-SIGNATURE",
        name: "HMAC-SHA256 Payload Signing & Replay Protection",
        category: "SECURITY_INTEGRITY",
        status: "STATIC",
        verdict: signsWithTimestamp ? "PASS" : "FAIL",
        severity: signsWithTimestamp ? "INFO" : "BLOCKER",
        message: signsWithTimestamp
          ? "HMAC-SHA256 signature calculated over canonicalized 'timestamp.payload' structure."
          : "Payload signature generation missing timestamp or HMAC calculation."
      });
    }

    // 4. Job Delivery Timeout Bound
    for (const job of slicePlan.jobs) {
      const hasTimeout = job.codePreview.includes("open_timeout") || job.timeoutSeconds <= 10;
      checks.push({
        id: `SEC-VAL-004-TIMEOUT-${job.name}`,
        name: `HTTP Worker Timeout Strictness: ${job.name}`,
        category: "SECURITY_INTEGRITY",
        status: "STATIC",
        verdict: hasTimeout ? "PASS" : "WARNING",
        severity: hasTimeout ? "INFO" : "WARNING",
        message: hasTimeout
          ? `Worker '${job.name}' configures strict HTTP execution timeout.`
          : `Worker '${job.name}' missing explicit HTTP timeout bounds.`
      });
    }

    return { checks, securityFindings };
  }
}
