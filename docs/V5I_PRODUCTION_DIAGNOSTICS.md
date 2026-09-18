# MCP Platform V5I — Production Diagnostics Engine Architecture

## 1. Visão Geral & Escopo

O pacote `@mcp-platform/production-diagnostics` atua como o sensor operacional e motor de inteligência de incidentes da plataforma MCP. Seu propósito exclusivo é **coletar, normalizar, correlacionar e explicar evidências operacionais de um SaaS sem alterar o ambiente de produção**.

### Invariantes Fundamentais:
```text
OBSERVE != DIAGNOSE
DIAGNOSE != PROVE_ROOT_CAUSE
ROOT_CAUSE_HYPOTHESIS != PATCH
PATCH != APPLY
APPLY != RELEASE
```

---

## 2. Pipeline Operacional

```text
Operational Streams (Logs, Errors, Metrics, Deployments, DB/Redis Health, Probes)
                                      ↓
                                NORMALIZATION
        (ISO-8601 Timestamps, Severities, Fingerprints, Redaction of Secrets & PII)
                                      ↓
                             INCIDENT TIMELINE
                       (Deterministic Chronological Order)
                                      ↓
                              SYMPTOM CLASSIFIER
           (HTTP 5xx, Timeouts, Connection Failures, Queue Backlogs, etc.)
                                      ↓
                                 CORRELATIONS
             ├── Temporal Correlation (Timeline Alignment)
             ├── Deployment Correlation (Pre/Post Error Changes)
             ├── Request Trace Correlation (request_id, trace_id)
             └── Architecture Graph Correlation (@mcp-platform/architecture-graph)
                                      ↓
                              HYPOTHESIS ENGINE
        (Root Cause Hypotheses + MANDATORY Contradicting Evidence Search)
                                      ↓
                              CONFIDENCE ENGINE
                           (LOW / MEDIUM / HIGH)
                                      ↓
                          SAFE REPRODUCTION PLAN
                   (Zero Production Mutation / Local Fixtures)
                                      ↓
                             DIAGNOSTIC HANDOFF
                  (Snapshot Digest + Cryptographic Receipt)
```

---

## 3. Estrutura do Pacote `@mcp-platform/production-diagnostics`

```text
packages/production-diagnostics/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                      # Exportações públicas
│   ├── types.ts                      # Definições completas de tipos
│   ├── diagnostics-engine.ts         # Orquestrador central unificado
│   ├── collectors/                   # Coletores vendor-neutral
│   │   ├── health-collector.ts
│   │   ├── log-collector.ts
│   │   ├── error-collector.ts
│   │   ├── metric-collector.ts
│   │   ├── deployment-collector.ts
│   │   ├── database-collector.ts
│   │   ├── redis-collector.ts
│   │   ├── sidekiq-collector.ts
│   │   ├── storage-collector.ts
│   │   └── endpoint-collector.ts
│   ├── normalization/                # Normalização e fingerprinting
│   │   ├── event-normalizer.ts
│   │   ├── timestamp-normalizer.ts
│   │   ├── severity-normalizer.ts
│   │   └── fingerprint-normalizer.ts
│   ├── correlation/                  # Motores de correlação
│   │   ├── temporal-correlator.ts
│   │   ├── deployment-correlator.ts
│   │   ├── request-correlator.ts
│   │   ├── component-correlator.ts
│   │   └── architecture-correlator.ts
│   ├── diagnosis/                    # Motores de diagnóstico e hipóteses
│   │   ├── symptom-classifier.ts
│   │   ├── hypothesis-engine.ts
│   │   ├── confidence-engine.ts
│   │   └── evidence-chain.ts
│   ├── security/                     # Proteção de segredos e queries
│   │   ├── credential-policy.ts
│   │   ├── secret-redactor.ts
│   │   ├── pii-redactor.ts
│   │   └── query-policy.ts
│   ├── discovery/                    # Descoberta estática de observabilidade
│   │   ├── observability-coverage.ts
│   │   └── coverage-scanner.ts
│   └── reports/                      # Relatórios, Snapshots e Receipts
│       └── diagnostics-report.ts
└── tests/
    ├── normalization.test.ts         # 4 testes PASS
    ├── security-redaction.test.ts    # 3 testes PASS
    ├── prompt-injection.test.ts      # 1 teste PASS
    ├── golden-incident.test.ts       # 1 teste PASS
    ├── false-causality.test.ts       # 1 teste PASS
    └── diagnostics-engine.test.ts    # 2 testes PASS
```
