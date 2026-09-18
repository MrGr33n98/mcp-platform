# V5 — SaaS Gap Analyzer Specification

**Package:** `@mcp-platform/saas-gap-analyzer`  
**Purpose:** Evidence-based compliance evaluation of any SaaS codebase against the Golden SaaS Blueprint.

---

## 1. Evaluation Model

The Gap Analyzer audits 11 core capability pillars:
1. `authentication` (Multi-Tenant Auth & Identity)
2. `tenancy` (Multi-Tenancy, Memberships & RBAC)
3. `billing` (SaaS Billing, Subscriptions & Monetization)
4. `api_keys` (Programmatic API Keys)
5. `webhooks` (Outgoing Webhooks)
6. `admin` (Operations & Backoffice Control)
7. `audit` (Immutable Security Audit Trails)
8. `telemetry` (Product Analytics & SaaS KPIs)
9. `health` (Health Monitoring & Node Observability)
10. `branding` (White-Labeling & Visual Theming)
11. `mcp` (Model Context Protocol & Agentic Integration)

---

## 2. Status & Priority Taxonomy

### Status Codes
- `PASS`: Complete implementation detected with evidence.
- `PARTIAL`: Implementation exists but lacks critical components (e.g. models exist but missing policies or delivery jobs).
- `MISSING`: Capability not present in codebase.
- `FAIL`: Broken or non-compliant implementation.

### Priorities
- `P0`: Security & Data Isolation Critical (Auth, Tenancy, Scopes).
- `P1`: Core SaaS Value & Operations (Billing, Admin, API Keys).
- `P2`: Integration & Scaling (Outgoing Webhooks, Telemetry).
- `P3`: Enhanced Customization (White-Labeling, Theming).

---

## 3. Real Product Validations

- **OEST / DroneHub:** Scored **73/100** (8 PASS, 0 PARTIAL, 3 MISSING). Missing: Outgoing Webhooks, Telemetry Ingestion, Dynamic Theming.
- **Avalia Solar (AB0-1-main):** Scored **9/100** (1 PASS, 10 MISSING). Accurately identified repository as non-canonical root without inventing false models or routes.
