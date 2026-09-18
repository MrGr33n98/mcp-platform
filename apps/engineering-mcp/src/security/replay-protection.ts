import { McpPlatformError } from "@mcp-platform/core";

export class ReplayProtectionTracker {
  private static readonly seenTokens = new Map<string, number>();
  private static readonly DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

  public static recordAndVerifyNonce(nonceOrApprovalId: string, ttlMs: number = this.DEFAULT_TTL_MS): void {
    if (!nonceOrApprovalId || typeof nonceOrApprovalId !== "string" || nonceOrApprovalId.trim().length === 0) {
      throw new McpPlatformError({
        code: "INVALID_APPROVAL_TOKEN",
        message: "Approval nonce or ID is required.",
      });
    }

    this.cleanupExpired();

    const now = Date.now();
    const existing = this.seenTokens.get(nonceOrApprovalId);
    if (existing !== undefined && existing > now) {
      throw new McpPlatformError({
        code: "REPLAY_ATTACK_DETECTED",
        message: `Approval token / nonce '${nonceOrApprovalId}' has already been consumed. Replay rejected.`,
      });
    }

    this.seenTokens.set(nonceOrApprovalId, now + ttlMs);
  }

  public static reset(): void {
    this.seenTokens.clear();
  }

  private static cleanupExpired(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.seenTokens.entries()) {
      if (expiresAt <= now) {
        this.seenTokens.delete(key);
      }
    }
  }
}
