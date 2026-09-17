import type { AuditEvent, AuditSink } from "./audit-sink.js";
import { redactSecrets } from "../logging/redaction.js";

export class ConsoleAuditSink implements AuditSink {
  async record(event: AuditEvent): Promise<void> {
    process.stderr.write(
      `${JSON.stringify(redactSecrets({ type: "mcp_audit", ...event }))}\n`,
    );
  }
}
