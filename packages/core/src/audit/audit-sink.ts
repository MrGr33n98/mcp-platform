export interface AuditEvent {
  readonly timestamp: string;
  readonly requestId: string;
  readonly productId: string;
  readonly toolName: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly errorCode?: string;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}
