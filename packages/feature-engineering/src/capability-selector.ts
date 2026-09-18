import type { GapReport, CapabilityAudit } from "@mcp-platform/saas-gap-analyzer";

export class CapabilitySelector {
  public static selectCapability(gapReport: GapReport, targetCapabilityId?: string | undefined): CapabilityAudit {
    if (targetCapabilityId) {
      const normalizedId = targetCapabilityId.toLowerCase().replace(/[-_]/g, "");
      const found = gapReport.audits.find((a) => {
        const aId = a.capabilityId.toLowerCase().replace(/[-_]/g, "");
        const aName = a.name.toLowerCase().replace(/[-_ ]/g, "");
        return aId === normalizedId || aName.includes(normalizedId) || normalizedId.includes(aId);
      });

      if (found) {
        return found;
      }

      // If specified capability is not explicitly in audits, synthesize an audit entry
      return {
        capabilityId: targetCapabilityId,
        name: targetCapabilityId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        status: "MISSING",
        priority: "P1",
        evidencePaths: [],
        evidence: [],
        requirements: [],
        existingImplementation: "None (Target capability explicitly selected)",
        missingPieces: ["Entire capability vertical slice"],
        securityGaps: ["Tenancy isolation enforcement required"],
        testGaps: ["Unit, request, and cross-tenant tests required"],
        dependencies: ["tenancy"]
      };
    }

    // Otherwise, pick highest priority non-PASS capability
    const nonPassAudits = gapReport.audits.filter(
      (a) => a.status === "MISSING" || a.status === "PARTIAL" || a.status === "FAIL"
    );

    if (nonPassAudits.length === 0) {
      // All pass or empty, pick the first audit or a default
      return (
        gapReport.audits[0] || {
          capabilityId: "webhooks",
          name: "Outgoing Webhooks",
          status: "MISSING",
          priority: "P2",
          evidencePaths: [],
          evidence: [],
          requirements: [],
          existingImplementation: "None",
          missingPieces: ["WebhookEndpoint", "DeliverPayloadJob", "WebhooksController"],
          securityGaps: ["HMAC signature", "SSRF protection"],
          testGaps: ["Full test suite"],
          dependencies: ["tenancy"]
        }
      );
    }

    // Sort by priority: P0 > P1 > P2 > P3
    const priorityWeight: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    nonPassAudits.sort((a, b) => (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99));

    return nonPassAudits[0]!;
  }
}
