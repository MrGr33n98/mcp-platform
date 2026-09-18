# Golden SaaS Blueprint — Architecture & Capability Reference

**Version:** 1.0.0  
**Specification Level:** Canonical Production Standards  
**Target Canonical Stack:**  
- **Backend:** Ruby on Rails (API mode / Full Stack), ActiveRecord, PostgreSQL / PostGIS, Redis, Sidekiq, ActiveStorage, ActiveAdmin, Pundit.
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui.
- **Billing & Analytics:** Stripe (Subscriptions, Metered, Invoicing, Tax, Portal), PostHog / Native Telemetry.
- **Storage & Infrastructure:** S3-Compatible Storage (AWS S3 / DigitalOcean Spaces), Docker, GitHub Actions CI/CD.
- **Agentic Operations:** Model Context Protocol (MCP) Server & CLI.

---

## 1. Blueprint Mission & Taxonomy

The Golden SaaS Blueprint is a formal specification that defines how modern, multi-tenant B2B and B2C software systems are structured. It distills the functional capabilities demonstrated by top-tier SaaS reference architectures (including `jonradoff/lastsaas`) and re-architects them natively for our canonical Rails / Next.js / PostgreSQL Golden Stack.

### Capability Taxonomy

| Category | Description | Capabilities |
|---|---|---|
| **CORE** | Identity, authentication, sessions, tenancy, and memberships | `identity`, `authentication`, `sessions`, `mfa`, `oauth`, `password-security`, `tenancy`, `memberships`, `invitations`, `rbac`, `ownership-transfer` |
| **BILLING** | Monetization, subscriptions, metering, credits, and transactions | `billing`, `subscriptions`, `plans`, `entitlements`, `credits`, `usage`, `transactions` |
| **INTEGRATION** | Public APIs, outgoing webhooks, and developer access | `api-keys`, `webhooks` |
| **UX & BRANDING** | Customization, branding, multi-theme, and white-labeling | `white-label`, `branding` |
| **ADMIN & OPS** | Backoffice management, activity logging, and audit trails | `admin`, `audit`, `activity-log` |
| **TELEMETRY & ANALYTICS** | Product analytics, conversion funnels, KPIs, and financials | `telemetry`, `product-analytics`, `financial-metrics` |
| **OBSERVABILITY** | Node health, system vitals, notifications, and alerts | `health-monitoring`, `notifications` |
| **DEVELOPER PLATFORM** | Self-service, API docs, storage, background jobs, testing, CI/CD, MCP, CLI | `self-service`, `api-docs`, `storage`, `background-jobs`, `security`, `testing`, `ci-cd`, `deployment`, `mcp`, `cli` |

---

## 2. Directory Structure

```text
docs/blueprints/golden-saas/
├── INDEX.md
├── identity.md
├── authentication.md
├── sessions.md
├── mfa.md
├── oauth.md
├── password-security.md
├── tenancy.md
├── memberships.md
├── invitations.md
├── rbac.md
├── ownership-transfer.md
├── billing.md
├── subscriptions.md
├── plans.md
├── entitlements.md
├── credits.md
├── usage.md
├── transactions.md
├── api-keys.md
├── webhooks.md
├── white-label.md
├── branding.md
├── admin.md
├── audit.md
├── activity-log.md
├── telemetry.md
├── product-analytics.md
├── financial-metrics.md
├── health-monitoring.md
├── notifications.md
├── self-service.md
├── api-docs.md
├── storage.md
├── background-jobs.md
├── security.md
├── testing.md
├── ci-cd.md
├── deployment.md
├── mcp.md
└── cli.md
```

Machine-readable representations reside in:
`blueprints/golden-saas/capabilities/*.yml`
