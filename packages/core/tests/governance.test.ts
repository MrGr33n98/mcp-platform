import { describe, expect, it } from "vitest";
import { ProposalEngine, computePayloadHash, McpPlatformError } from "../src/index.js";

describe("ProposalEngine (HITL Governance)", () => {
  it("creates, retrieves and hashes a proposal with deterministic SHA-256", () => {
    const engine = new ProposalEngine();
    const payload = { mission_id: "123", action: "cancel", reason: "Weather" };

    const proposal = engine.propose({
      toolName: "cancel_order",
      payload,
      description: "Cancel flight mission due to thunderstorm",
      proposer: "claude-agent",
    });

    expect(proposal.id).toMatch(/^prop-/);
    expect(proposal.status).toBe("pending");
    expect(proposal.toolName).toBe("cancel_order");
    expect(proposal.payloadHash).toBe(computePayloadHash(payload));
    expect(proposal.proposer).toBe("claude-agent");

    const retrieved = engine.get(proposal.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(proposal.id);
  });

  it("approves a pending proposal and rejects invalid transitions", () => {
    const engine = new ProposalEngine();
    const proposal = engine.propose({
      toolName: "publish_mission",
      payload: { id: "m-55" },
    });

    expect(engine.listPending()).toHaveLength(1);

    const approved = engine.approve(proposal.id, "human-operator-alice");
    expect(approved.status).toBe("approved");
    expect(approved.approver).toBe("human-operator-alice");
    expect(engine.listPending()).toHaveLength(0);

    // Double approval fails
    expect(() => engine.approve(proposal.id, "bob")).toThrowError(McpPlatformError);

    // Mark executed
    const executed = engine.markExecuted(proposal.id);
    expect(executed.status).toBe("executed");
    expect(executed.executedAt).toBeDefined();
  });

  it("handles proposal rejection cleanly", () => {
    const engine = new ProposalEngine();
    const proposal = engine.propose({
      toolName: "cancel_order",
      payload: { id: "ord-99" },
    });

    const rejected = engine.reject(proposal.id, "manager-bob");
    expect(rejected.status).toBe("rejected");
    expect(rejected.approver).toBe("manager-bob");
  });

  it("expires proposal when TTL is exceeded", () => {
    const engine = new ProposalEngine();
    const proposal = engine.propose({
      toolName: "update_order",
      payload: { id: "1" },
      ttlMs: -1000, // Expired in the past
    });

    const fetched = engine.get(proposal.id);
    expect(fetched?.status).toBe("expired");
    expect(() => engine.approve(proposal.id, "alice")).toThrowError(McpPlatformError);
  });
});
