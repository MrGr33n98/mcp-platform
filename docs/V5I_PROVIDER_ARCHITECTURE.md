# MCP Platform V5I — Vendor-Neutral Provider Architecture

## 1. Desacoplamento de Provedores

A plataforma MCP não depende de nenhum fornecedor proprietário de APM ou observabilidade. O core de diagnósticos interage exclusivamente através de interfaces abstratas tipadas:

```typescript
export interface LogProvider {
  name: string;
  fetchRecentLogs(limit?: number): Promise<Observation[]>;
}

export interface MetricsProvider {
  name: string;
  fetchMetrics(): Promise<Observation[]>;
}

export interface ErrorProvider {
  name: string;
  fetchRecentErrors(): Promise<Observation[]>;
}

export interface DeploymentProvider {
  name: string;
  fetchRecentDeployments(): Promise<DeploymentRecord[]>;
}

export interface DatabaseHealthProvider {
  name: string;
  fetchDatabaseHealth(): Promise<Observation[]>;
}

export interface CacheHealthProvider {
  name: string;
  fetchCacheHealth(): Promise<Observation[]>;
}

export interface QueueHealthProvider {
  name: string;
  fetchQueueHealth(): Promise<Observation[]>;
}

export interface StorageHealthProvider {
  name: string;
  fetchStorageHealth(): Promise<Observation[]>;
}
```

---

## 2. Adapters Suportados & Extensibilidade

| Subsistema | Implementações de Referência |
| :--- | :--- |
| **Logs** | Rails Application Logs, stdout/stderr streams, CloudWatch, Docker logs. |
| **Erros** | Sentry, Rollbar, Bugsnag, Exception Notification. |
| **Métricas** | New Relic, Datadog, Prometheus, CloudWatch. |
| **Deployments** | Git commits, GitHub Actions, GitLab CI, Kubernetes Rollouts. |
| **Banco de Dados** | PostgreSQL `pg_stat_activity`, MySQL `SHOW PROCESSLIST`. |
| **Cache & Filas** | Redis `INFO`, Sidekiq Stats API, RabbitMQ metrics. |
| **Storage** | ActiveStorage health, AWS S3 API probes. |
