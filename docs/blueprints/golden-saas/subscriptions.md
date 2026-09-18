# Capability: Subscription Lifecycle & Stripe Integration (subscriptions)

## Purpose
Manages SaaS subscription lifecycle (trialing, active, past_due, canceled, paused), Stripe billing synchronization, per-seat quantities, and customer portal self-service.

## Functional Requirements
- Integration with Stripe Checkout for seamless plan subscriptions.
- Synchronization of subscription status changes via asynchronous Stripe webhooks.
- Per-seat license billing with automated quantity adjustments on member add/remove.
- Support for trial periods with automatic transition to paid or expired state.
- Customer Billing Portal integration for updating payment methods and downloading invoices.

## Domain Objects
- `Subscription`: Active or historical subscription record.

## Database Requirements
- Table `subscriptions`: `id` (UUID), `organization_id` (FK, unique), `plan_id` (FK), `stripe_customer_id` (string), `stripe_subscription_id` (string, unique, indexed), `status` (enum: trialing, active, past_due, canceled), `seats` (integer, default: 1), `current_period_start` (datetime), `current_period_end` (datetime), `cancel_at_period_end` (boolean).

## Backend Responsibilities
- `Billing::StripeSubscriptionSyncer` service.
- Handling Stripe webhook events (`customer.subscription.created`, `updated`, `deleted`).
- Automated seat quantity adjustment when organization membership count changes.

## Authorization Requirements
- Only `Owner` and `Admin` can change plans or access the billing portal.

## API Requirements
- `GET /api/v1/billing/subscription` (current subscription status and plan details).
- `POST /api/v1/billing/checkout_session` (creates Stripe Checkout session).
- `POST /api/v1/billing/portal_session` (creates Stripe Customer Portal session).
- `POST /api/v1/billing/cancel` (schedule cancellation at period end).

## ActiveAdmin Requirements
- Resource `Subscription`: View Stripe customer IDs, override subscription status, manually change plan.

## Customer Frontend Requirements
- Billing Settings page displaying current plan, renewal date, seat count, and "Manage Subscription in Stripe" button.

## Background Jobs
- `Billing::SyncStripeSubscriptionJob`: Syncs subscription state on webhook receipt.

## Events
- `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`.

## Webhooks
- `billing.subscription_updated`.

## Telemetry
- Track `billing.plan_upgraded`, `billing.plan_downgraded`, `billing.canceled`.

## Observability
- Active subscriber count, churn rate, trial conversion rate.

## Security Requirements
- Idempotent webhook handling with event ID tracking.
- Webhook signature verification mandatory.

## Failure Modes
- Stripe API unreachable -> Allow grace period for existing subscribers.

## Required Tests
- Service specs: Webhook synchronization with Stripe event payloads.
- Request specs: Portal session creation and authentication checks.

## Acceptance Criteria
- 100% idempotent Stripe webhook handling.

## Definition of Done
- Rails `Subscription` model, Stripe webhook processor, Next.js billing portal redirect, and tests verified.

## LastSaaS Evidence
- `backend/internal/stripe/`, `backend/internal/api/handlers/billing.go`.

## Golden Stack Adaptation
- Rails 8 `stripe` gem + Sidekiq webhook processing.

## Optional / Product-specific Extensions
- Pause subscription flow with discounted holding rate.
