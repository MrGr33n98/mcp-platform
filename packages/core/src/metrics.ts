export interface ToolExecutionMetric {
  readonly toolName: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly errorCode?: string;
  readonly timestamp: string;
}

export interface MetricSummary {
  readonly totalExecutions: number;
  readonly totalSuccess: number;
  readonly totalErrors: number;
  readonly errorRate: number;
  readonly latency: {
    readonly minMs: number;
    readonly maxMs: number;
    readonly avgMs: number;
    readonly p95Ms: number;
  };
  readonly toolBreakdown: Record<
    string,
    {
      readonly count: number;
      readonly errors: number;
      readonly avgDurationMs: number;
    }
  >;
  readonly errorCodeBreakdown: Record<string, number>;
}

export class MetricsCollector {
  private readonly metrics: ToolExecutionMetric[] = [];
  private readonly maxRecords: number;

  constructor(maxRecords = 10_000) {
    this.maxRecords = maxRecords;
  }

  record(metric: Omit<ToolExecutionMetric, "timestamp">): void {
    if (this.metrics.length >= this.maxRecords) {
      this.metrics.shift();
    }
    this.metrics.push({
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  getMetrics(): readonly ToolExecutionMetric[] {
    return [...this.metrics];
  }

  clear(): void {
    this.metrics.length = 0;
  }

  getSummary(): MetricSummary {
    const total = this.metrics.length;
    if (total === 0) {
      return {
        totalExecutions: 0,
        totalSuccess: 0,
        totalErrors: 0,
        errorRate: 0,
        latency: { minMs: 0, maxMs: 0, avgMs: 0, p95Ms: 0 },
        toolBreakdown: {},
        errorCodeBreakdown: {},
      };
    }

    let successCount = 0;
    let errorCount = 0;
    const durations: number[] = [];
    const toolBreakdown: Record<string, { count: number; errors: number; totalDuration: number }> = {};
    const errorCodeBreakdown: Record<string, number> = {};

    for (const m of this.metrics) {
      durations.push(m.durationMs);
      if (m.success) {
        successCount++;
      } else {
        errorCount++;
        if (m.errorCode) {
          errorCodeBreakdown[m.errorCode] = (errorCodeBreakdown[m.errorCode] ?? 0) + 1;
        }
      }

      const tb = toolBreakdown[m.toolName] ?? { count: 0, errors: 0, totalDuration: 0 };
      tb.count++;
      if (!m.success) {
        tb.errors++;
      }
      tb.totalDuration += m.durationMs;
      toolBreakdown[m.toolName] = tb;
    }

    durations.sort((a, b) => a - b);
    const minMs = durations[0] ?? 0;
    const maxMs = durations[durations.length - 1] ?? 0;
    const avgMs = Math.round((durations.reduce((acc, d) => acc + d, 0) / total) * 100) / 100;
    const p95Index = Math.min(Math.floor(durations.length * 0.95), durations.length - 1);
    const p95Ms = durations[p95Index] ?? 0;

    const formattedToolBreakdown: Record<string, { count: number; errors: number; avgDurationMs: number }> = {};
    for (const [name, stats] of Object.entries(toolBreakdown)) {
      formattedToolBreakdown[name] = {
        count: stats.count,
        errors: stats.errors,
        avgDurationMs: Math.round((stats.totalDuration / stats.count) * 100) / 100,
      };
    }

    return {
      totalExecutions: total,
      totalSuccess: successCount,
      totalErrors: errorCount,
      errorRate: Math.round((errorCount / total) * 10000) / 10000,
      latency: { minMs, maxMs, avgMs, p95Ms },
      toolBreakdown: formattedToolBreakdown,
      errorCodeBreakdown,
    };
  }
}
