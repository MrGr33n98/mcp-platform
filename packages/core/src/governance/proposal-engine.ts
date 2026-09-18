import { createHash, randomUUID } from "node:crypto";
import { McpPlatformError } from "../errors/mcp-platform-error.js";

export type ProposalStatus = "pending" | "approved" | "rejected" | "expired" | "executed";

export interface Proposal {
  readonly id: string;
  readonly toolName: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadHash: string;
  readonly description?: string;
  status: ProposalStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly proposer: string;
  approver?: string;
  executedAt?: string;
}

export interface ProposeActionOptions {
  readonly toolName: string;
  readonly payload: Record<string, unknown>;
  readonly description?: string;
  readonly proposer?: string;
  /** TTL in milliseconds (default: 3,600,000 ms / 1 hour) */
  readonly ttlMs?: number;
}

export function computePayloadHash(payload: Record<string, unknown>): string {
  const serialized = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(serialized).digest("hex");
}

export class ProposalEngine {
  private readonly proposals = new Map<string, Proposal>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 3_600_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  propose(options: ProposeActionOptions): Proposal {
    const id = `prop-${randomUUID()}`;
    const now = Date.now();
    const ttl = options.ttlMs ?? this.defaultTtlMs;
    const expiresAt = new Date(now + ttl).toISOString();
    const payloadHash = computePayloadHash(options.payload);

    const proposal: Proposal = {
      id,
      toolName: options.toolName,
      payload: Object.freeze({ ...options.payload }),
      payloadHash,
      status: "pending",
      createdAt: new Date(now).toISOString(),
      expiresAt,
      proposer: options.proposer ?? "ai-agent",
      ...(options.description !== undefined ? { description: options.description } : {}),
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  private cleanExpired(proposal: Proposal): Proposal {
    if (proposal.status === "pending" && new Date(proposal.expiresAt).getTime() < Date.now()) {
      proposal.status = "expired";
    }
    return proposal;
  }

  get(id: string): Proposal | undefined {
    const proposal = this.proposals.get(id);
    if (!proposal) return undefined;
    return this.cleanExpired(proposal);
  }

  listPending(): readonly Proposal[] {
    const pending: Proposal[] = [];
    for (const proposal of this.proposals.values()) {
      this.cleanExpired(proposal);
      if (proposal.status === "pending") {
        pending.push(proposal);
      }
    }
    return pending;
  }

  approve(id: string, approver: string): Proposal {
    const proposal = this.get(id);
    if (!proposal) {
      throw new McpPlatformError({
        code: "PROPOSAL_NOT_FOUND",
        message: `Proposal ${id} was not found.`,
        retryable: false,
      });
    }

    if (proposal.status === "expired") {
      throw new McpPlatformError({
        code: "PROPOSAL_EXPIRED",
        message: `Proposal ${id} has expired.`,
        retryable: false,
      });
    }

    if (proposal.status !== "pending") {
      throw new McpPlatformError({
        code: "PROPOSAL_INVALID_STATE",
        message: `Proposal ${id} is already ${proposal.status}.`,
        retryable: false,
      });
    }

    proposal.status = "approved";
    proposal.approver = approver;
    return proposal;
  }

  reject(id: string, rejector: string): Proposal {
    const proposal = this.get(id);
    if (!proposal) {
      throw new McpPlatformError({
        code: "PROPOSAL_NOT_FOUND",
        message: `Proposal ${id} was not found.`,
        retryable: false,
      });
    }

    if (proposal.status !== "pending") {
      throw new McpPlatformError({
        code: "PROPOSAL_INVALID_STATE",
        message: `Proposal ${id} is already ${proposal.status}.`,
        retryable: false,
      });
    }

    proposal.status = "rejected";
    proposal.approver = rejector;
    return proposal;
  }

  markExecuted(id: string): Proposal {
    const proposal = this.get(id);
    if (!proposal) {
      throw new McpPlatformError({
        code: "PROPOSAL_NOT_FOUND",
        message: `Proposal ${id} was not found.`,
        retryable: false,
      });
    }

    if (proposal.status !== "approved") {
      throw new McpPlatformError({
        code: "PROPOSAL_NOT_APPROVED",
        message: `Proposal ${id} must be approved before execution (current: ${proposal.status}).`,
        retryable: false,
      });
    }

    proposal.status = "executed";
    proposal.executedAt = new Date().toISOString();
    return proposal;
  }
}
