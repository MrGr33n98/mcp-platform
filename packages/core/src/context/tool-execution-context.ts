import { randomUUID } from "node:crypto";

export interface ToolExecutionContext {
  readonly requestId: string;
  readonly productId: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  readonly scopes: readonly string[];
  readonly startedAt: Date;
}

export interface CreateToolExecutionContextOptions {
  readonly productId: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  readonly scopes?: readonly string[];
  readonly requestId?: string;
  readonly startedAt?: Date;
}

export function generateRequestId(): string {
  return randomUUID();
}

export function createToolExecutionContext(
  options: CreateToolExecutionContextOptions,
): ToolExecutionContext {
  return {
    requestId: options.requestId ?? generateRequestId(),
    productId: options.productId,
    ...(options.tenantId === undefined ? {} : { tenantId: options.tenantId }),
    ...(options.actorId === undefined ? {} : { actorId: options.actorId }),
    scopes: Object.freeze([...(options.scopes ?? [])]),
    startedAt: options.startedAt ?? new Date(),
  };
}
