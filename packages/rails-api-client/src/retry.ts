const retryableStatuses = new Set([429, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return retryableStatuses.has(status);
}

export function shouldRetry(attempt: number, maxRetries: number): boolean {
  return attempt < maxRetries;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(100 * 2 ** attempt, 500);
}

export function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
