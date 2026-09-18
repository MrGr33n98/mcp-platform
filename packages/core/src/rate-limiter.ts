import { McpPlatformError } from "./errors/mcp-platform-error.js";

export interface RateLimiterOptions {
  /** Maximum requests allowed per window */
  readonly maxRequests: number;
  /** Window size in milliseconds (default: 60,000 ms / 1 minute) */
  readonly windowMs?: number;
  /** Optional burst limit (max tokens available at once, default = maxRequests) */
  readonly burstCapacity?: number;
}

export interface RateLimiter {
  acquire(): Promise<void>;
  tryAcquire(): boolean;
  getAvailableTokens(): number;
  reset(): void;
}

export class TokenBucketRateLimiter implements RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly burstCapacity: number;
  private tokens: number;
  private lastRefillTimestamp: number;

  constructor(options: RateLimiterOptions) {
    if (options.maxRequests <= 0) {
      throw new Error("RateLimiter maxRequests must be greater than 0.");
    }
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs ?? 60_000;
    this.burstCapacity = options.burstCapacity ?? options.maxRequests;
    this.tokens = this.burstCapacity;
    this.lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTimestamp;
    if (elapsed > 0) {
      const refillRate = this.maxRequests / this.windowMs;
      const tokensToAdd = elapsed * refillRate;
      this.tokens = Math.min(this.burstCapacity, this.tokens + tokensToAdd);
      this.lastRefillTimestamp = now;
    }
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  async acquire(): Promise<void> {
    if (!this.tryAcquire()) {
      throw new McpPlatformError({
        code: "RAILS_API_RATE_LIMITED",
        message: `Client-side rate limit reached (${this.maxRequests} req / ${this.windowMs / 1000}s).`,
        retryable: true,
      });
    }
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  reset(): void {
    this.tokens = this.burstCapacity;
    this.lastRefillTimestamp = Date.now();
  }
}
