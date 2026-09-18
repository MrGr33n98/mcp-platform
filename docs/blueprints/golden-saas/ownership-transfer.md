# Capability: Organization Ownership Transfer (ownership-transfer)

## Purpose
Enables an organization Owner to transfer primary ownership and billing accountability to another existing team member through a secure, two-step confirmation protocol.

## Functional Requirements
- Owner initiates transfer request selecting an existing `Admin` or `Member`.
- System creates a time-limited (48h) transfer proposal and sends confirmation email.
- Current owner re-authenticates password; prospective owner receives accept/decline prompt.
- On acceptance: atomic role swap (new user becomes `Owner`, previous owner becomes `Admin`).
- Stripe customer and billing records seamlessly update to reflect new owner.

## Domain Objects
- `OwnershipTransferRequest`: Pending ownership transfer state record.

## Database Requirements
- Table `ownership_transfers`: `id` (UUID), `organization_id` (FK), `current_owner_id` (FK), `target_owner_id` (FK), `token_digest` (string, unique), `status` (enum: pending, accepted, canceled, expired), `expires_at` (datetime), `created_at` (datetime).

## Backend Responsibilities
- `Tenancy::TransferOwnership` service executing atomic database transaction.
- Invalidation of previous transfer requests when a new one is created.

## Authorization Requirements
- Only the current `Owner` can initiate or cancel an ownership transfer.

## API Requirements
- `POST /api/v1/organizations/current/transfer_ownership` (initiate transfer).
- `POST /api/v1/ownership_transfers/:token/accept` (prospective owner accepts).
- `DELETE /api/v1/organizations/current/transfer_ownership` (current owner cancels).

## ActiveAdmin Requirements
- View ongoing and historical ownership transfers; emergency manual transfer with executive audit log.

## Customer Frontend Requirements
- Danger Zone section in Organization Settings with "Transfer Ownership" modal and password re-entry.

## Background Jobs
- `Tenancy::SendOwnershipTransferNotificationJob`: Dispatches emails to both parties.

## Events
- `ownership.transfer_initiated`, `ownership.transfer_completed`, `ownership.transfer_canceled`.

## Webhooks
- `team.ownership_transferred`.

## Telemetry
- Track `team.ownership_transfers_count`.

## Observability
- Audit log of ownership transitions.

## Security Requirements
- Mandatory password re-entry for the transferring owner.
- Atomic transaction guaranteeing an organization never has 0 or 2 owners.

## Failure Modes
- Target owner leaves organization before accepting -> Transfer request automatically cancelled.

## Required Tests
- Service specs: atomic role swap in transaction, expired transfer rejection.
- Request specs: authorization checks blocking non-owners from initiating transfer.

## Acceptance Criteria
- 100% atomic execution with zero state inconsistency.

## Definition of Done
- Rails `OwnershipTransfer` model, service, controller, and Next.js Danger Zone UI verified.

## LastSaaS Evidence
- `backend/internal/api/handlers/tenant.go` (`TransferOwnership`), `cmd_tenants.go`.

## Golden Stack Adaptation
- Rails ActiveRecord transaction + Pundit `OrganizationPolicy#transfer_ownership?`.

## Optional / Product-specific Extensions
- Legal sign-off step for enterprise contract transfers.
