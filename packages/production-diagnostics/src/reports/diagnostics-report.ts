import { createHash } from "node:crypto";
import type {
  Incident,
  IncidentTimeline,
  DiagnosticSnapshot,
  DiagnosticsReceipt,
  DiagnosticHandoff,
  ReproductionPlan,
  ObservabilityCoverage,
  Observation,
} from "../types.js";

export class DiagnosticsReportGenerator {
  public static createSnapshot(
    environment: string,
    observations: Observation[],
    providerStatus: Record<string, string>,
    deploymentRevision?: string | undefined
  ): DiagnosticSnapshot {
    const snapshotId = `diag_snap_${Date.now()}`;
    const capturedAt = new Date().toISOString();

    const snapshotPayload = JSON.stringify({
      environment,
      capturedAt,
      deploymentRevision,
      observations,
      providerStatus,
    });

    const digest = createHash("sha256").update(snapshotPayload).digest("hex");

    return {
      snapshot_id: snapshotId,
      environment,
      captured_at: capturedAt,
      deployment_revision: deploymentRevision,
      observations,
      provider_status: providerStatus,
      digest,
    };
  }

  public static createReceipt(
    snapshot: DiagnosticSnapshot,
    incident: Incident
  ): DiagnosticsReceipt {
    const evidencePayload = JSON.stringify(incident.evidence);
    const evidenceDigest = createHash("sha256").update(evidencePayload).digest("hex");

    return {
      schema_version: 1,
      receipt_type: "DIAGNOSTICS_RECEIPT",
      diagnostics_id: `diag_rec_${Date.now()}`,
      snapshot_digest: snapshot.digest,
      incident_id: incident.incident_id,
      environment: snapshot.environment,
      created_at: new Date().toISOString(),
      evidence_digest: evidenceDigest,
    };
  }

  public static createHandoff(
    incident: Incident,
    snapshotDigest: string,
    reproductionPlan: ReproductionPlan
  ): DiagnosticHandoff {
    return {
      incident,
      snapshot_digest: snapshotDigest,
      hypotheses: incident.hypotheses,
      affected_components: incident.affected_components,
      candidate_tests: incident.hypotheses.flatMap(h => h.candidate_tests),
      reproduction_plan: reproductionPlan,
      evidence: incident.evidence,
    };
  }

  public static generateMarkdown(
    incident: Incident,
    timeline: IncidentTimeline,
    snapshot: DiagnosticSnapshot,
    receipt: DiagnosticsReceipt,
    coverage: ObservabilityCoverage,
    reproductionPlan: ReproductionPlan
  ): string {
    const symptomsTable = incident.symptoms
      .map(
        s =>
          `| \`${s.type}\` | \`${s.severity}\` | ${s.count} | \`${s.affected_components.join(", ") || "app"}\` | ${s.description} |`
      )
      .join("\n");

    const timelineList = timeline.events
      .map(e => `- **\`${e.timestamp}\`** [${e.type}] *${e.source}*: ${e.summary}`)
      .join("\n");

    const hypothesesSection = incident.hypotheses
      .map(h => {
        const contra =
          h.contradicting_evidence.length > 0
            ? `\n  - **Contradicting Evidence:**\n` +
              h.contradicting_evidence.map(c => `    - ⚠️ *${c.relevance}:* ${c.description}`).join("\n")
            : "\n  - **Contradicting Evidence:** None found.";

        const steps = h.verification_steps.map(v => `    1. ${v}`).join("\n");

        return `### 🔍 [${h.confidence} Confidence] ${h.title}\n${h.description}\n- **Affected Components:** \`${h.affected_components.join(", ") || "None"}\`\n- **Candidate Tests:** \`${h.candidate_tests.join(", ") || "None"}\`${contra}\n- **Verification Steps:**\n${steps}`;
      })
      .join("\n\n");

    const reproductionSteps = reproductionPlan.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n");

    return `# Production Diagnostics Report — ${incident.incident_id}

## 📊 Incident Summary

- **Title:** ${incident.title}
- **Status:** \`${incident.status}\`
- **Environment:** \`${snapshot.environment}\`
- **Started At:** \`${incident.started_at}\`
- **Detected At:** \`${incident.detected_at}\`
- **Affected Services:** \`${incident.affected_services.join(", ") || "None"}\`
- **Affected Components:** \`${incident.affected_components.join(", ") || "None"}\`

---

## 🚨 Observable Symptoms

| Symptom | Severity | Count | Components | Description |
| :--- | :--- | :--- | :--- | :--- |
${symptomsTable || "| None | INFO | 0 | - | No anomalies detected |"}

---

## ⏱️ Incident Timeline

${timelineList || "No timeline events recorded."}

---

## 🧠 Root Cause Hypotheses & Contradicting Evidence

${hypothesesSection || "No hypotheses generated."}

---

## 🧪 Safe Reproduction Plan (Zero Production Mutation)

- **Target Symptom:** \`${reproductionPlan.symptom}\`
- **Candidate Component:** \`${reproductionPlan.candidate_component}\`
- **Recommended Safe Environment:** \`${reproductionPlan.safe_environment}\`
- **Expected Failure:** ${reproductionPlan.expected_failure}
- **Existing Regression Tests:** \`${reproductionPlan.existing_tests.join(", ") || "None"}\`
- **New Regression Test Required:** ${reproductionPlan.new_regression_test_needed ? "YES" : "NO"}

### Steps to Reproduce:
${reproductionSteps}

---

## 📡 Observability Coverage

| Category | Status |
| :--- | :--- |
| **Logs** | \`${coverage.logs}\` |
| **Metrics & APM** | \`${coverage.metrics}\` |
| **Error Tracker** | \`${coverage.errors}\` |
| **Deployments** | \`${coverage.deployments}\` |
| **Database Health** | \`${coverage.database}\` |
| **Redis Store** | \`${coverage.redis}\` |
| **Background Jobs** | \`${coverage.jobs}\` |
| **Object Storage** | \`${coverage.storage}\` |

**Configured Providers:** ${coverage.configured_providers.map(p => `\`${p}\``).join(", ") || "None"}

---

## 🏷️ Cryptographic Diagnostics Receipt

| Parameter | Value |
| :--- | :--- |
| **Diagnostics ID** | \`${receipt.diagnostics_id}\` |
| **Snapshot Digest** | \`${receipt.snapshot_digest.substring(0, 16)}...\` |
| **Evidence Digest** | \`${receipt.evidence_digest.substring(0, 16)}...\` |
| **Created At** | \`${receipt.created_at}\` |
`;
  }
}
