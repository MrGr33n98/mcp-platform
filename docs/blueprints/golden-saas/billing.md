# Capability: SaaS Billing, Subscriptions & Monetization (Billing, Subscriptions, Plans, Entitlements, Credits, Usage, Transactions)

## Purpose
Provides end-to-end subscription lifecycle management, Stripe integration, flat and per-seat pricing models, free trials, dual-credit buckets (subscription + purchased), usage-based entitlement enforcement, invoices, refunds, and dispute handling.

## Functional Requirements
- Multi-tier subscription plans (e.g. Starter, Pro, Enterprise) with monthly and annual billing intervals.
- Per-seat pricing with minimum and maximum seat limits.
- Free trials with configurable trial duration and abuse detection across tenant and payment methods.
- Dual-credit balance system: monthly renewing subscription credits + non-expiring purchased credit bundles.
- Server-side entitlement enforcement engine (boolean feature flags and numeric limits).
- Stripe Checkout for new subscriptions and Stripe Customer Portal for self-service billing management.
- Webhook-driven synchronization for `customer.subscription.updated`, `invoice.payment_succeeded`, `charge.refunded`, `charge.dispute.created`.
- Comprehensive transaction history with PDF invoice download support.

## Domain Objects
- `Plan`: Subscription tier defining pricing, interval, seat rules, and entitlement limits.
- `Subscription`: Active or past-due tenant subscription linked to Stripe (`stripe_subscription_id`).
- `Entitlement`: Server-side limit definition (type: `boolean`, `integer`, `decimal`, `enum`).
- `CreditBucket`: Dual ledger for `subscription_credits` and `purchased_credits`.
- `CreditTransaction`: Immutable ledger entry recording credit grants, deductions, and refunds.
- `BillingTransaction`: Financial ledger record (invoices, payments, refunds, disputes).
- `CreditBundle`: Catalog of purchasable one-time credit packs.

## Database Requirements
- Table `plans`: `id` (UUID), `name` (string), `stripe_price_id` (string), `price_cents` (integer), `interval` (enum: month, year), `trial_days` (integer), `entitlements` (jsonb), `active` (boolean).
- Table `subscriptions`: `id` (UUID), `organization_id` (FK, unique), `plan_id` (FK), `stripe_customer_id` (string), `stripe_subscription_id` (string, unique), `status` (enum: trialing, active, past_due, canceled), `current_period_end` (datetime), `seats` (integer).
- Table `credit_balances`: `id` (UUID), `organization_id` (FK, unique), `subscription_credits` (bigint), `purchased_credits` (bigint), `updated_at` (datetime).
- Table `credit_transactions`: `id` (UUID), `organization_id` (FK), `bucket` (enum: subscription, purchased), `amount` (bigint), `balance_after` (bigint), `reason` (string), `created_at` (datetime).
- Table `billing_transactions`: `id` (UUID), `organization_id` (FK), `stripe_invoice_id` (string), `amount_cents` (integer), `currency` (string), `status` (string), `pdf_url` (string), `created_at` (datetime).

## Backend Responsibilities
- Stripe Webhook handling service (`Billing::StripeWebhookHandler`).
- Atomic credit deduction service (`Billing::DeductCredits`) using PostgreSQL row locking (`SELECT FOR UPDATE`).
- Server-side entitlement check middleware (`authorize_entitlement!(:api_enabled)`).
- Syncing Stripe customer IDs and payment status.

## Authorization Requirements
- Only Organization `Owner` or `Admin` can update plans, purchase credits, or access the Stripe Customer Portal.
- All billing queries must be strictly scoped to `Current.organization`.

## API Requirements
- `GET /api/v1/billing/subscription` (current plan, renewal date, seats, status).
- `POST /api/v1/billing/checkout_session` (generate Stripe Checkout URL for upgrade/downgrade).
- `POST /api/v1/billing/portal_session` (generate Stripe Customer Portal URL).
- `GET /api/v1/billing/credits` (balance summary and recent consumption).
- `POST /api/v1/billing/credit_bundles/:id/purchase` (checkout session for credit pack).
- `GET /api/v1/billing/transactions` (paginated invoice and transaction history).
- `POST /api/v1/webhooks/stripe` (incoming webhook receiver with HMAC signature verification).

## ActiveAdmin Requirements
- ActiveAdmin resource `Plan`: Manage pricing, entitlement schema, and active status.
- ActiveAdmin resource `Subscription`: View tenant billing state, override credits, inspect Stripe IDs.
- ActiveAdmin resource `BillingTransaction`: View global revenue, refunds, and dispute audits.

## Customer Frontend Requirements
- Next.js pricing table with monthly/yearly toggle.
- Billing settings dashboard: Current plan badge, usage progress bars against entitlements, credit balance cards with "Buy Credits" modal, and invoice table with PDF links.

## Background Jobs
- `Billing::ProcessStripeWebhookJob`: Asynchronous processing of incoming Stripe events.
- `Billing::ResetMonthlySubscriptionCreditsJob`: Monthly job resetting subscription credit allocations.
- `Billing::SyncStripeInvoicesJob`: Periodic reconciliation of pending invoices.

## Events
- `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `credits.deducted`, `credits.purchased`, `invoice.paid`, `charge.refunded`, `charge.disputed`.

## Webhooks
- Outgoing webhooks: `billing.subscription_updated`, `billing.invoice_paid`, `billing.credits_depleted`.

## Telemetry
- Track `billing.checkout_started`, `billing.plan_upgraded`, `billing.plan_downgraded`, `billing.credits_purchased`, `billing.portal_opened`.

## Observability
- SaaS Metrics: MRR, ARR, ARPU, Churn Rate, LTV, Trial-to-Paid Conversion Rate.
- Technical Metrics: Stripe webhook processing latency, webhook signature failure rates.

## Security Requirements
- Stripe webhook signature verification (`Stripe::Webhook.construct_event`) using raw body and endpoint secret.
- Idempotent webhook execution using database transaction locks and event ID deduplication.
- Raw cardholder data never touches our servers (100% Stripe hosted).

## Failure Modes
- Stripe API outage -> Read-only fallback allowing cached entitlement grace period.
- Webhook delivery retry -> Handled via idempotent `event_id` tracking.
- Insufficient credits -> Return `402 Payment Required` with `INSUFFICIENT_CREDITS` code.

## Required Tests
- Model specs: Credit calculation, plan entitlement schema validation.
- Service specs: Webhook processing with mocked Stripe fixtures (charge, invoice, refund, dispute).
- Concurrency specs: Parallel credit deductions preventing negative balance.
- Request specs: Stripe webhook signature validation, portal redirect generation.

## Acceptance Criteria
- Zero double-billing or unrecorded credit deductions.
- 100% idempotent webhook processing.
- Entitlement limits enforced strictly on backend before any expensive operation.

## Definition of Done
- Complete Rails billing domain models, Stripe webhook handler, Sidekiq jobs, ActiveAdmin tools, Next.js billing pages, and unit/integration tests verified with $>90\%$ coverage.

## LastSaaS Evidence
- `backend/internal/stripe/`, `backend/internal/planstore/`.
- `backend/internal/api/handlers/billing.go` (30KB), `plans.go` (27KB), `bundles.go` (7KB), `webhook.go` (30KB).
- Models: `billing.go`, `plan.go`, `credit_bundle.go`, `usage_event.go`.
- MCP tools: `list_plans`, `get_plan`, `list_credit_bundles`, `list_transactions`, `get_financial_metrics`, `get_kpis`.

## Golden Stack Adaptation
- Implement using Rails ActiveRecord + Stripe gem (`stripe`), Sidekiq for background webhook processing, and Next.js frontend integrated with Stripe Elements / Checkout / Customer Portal.

## Optional / Product-specific Extensions
- Metered usage billing (e.g. per-gigabyte storage or per-flight drone survey minute).
- Custom invoicing / purchase orders for enterprise sales.
