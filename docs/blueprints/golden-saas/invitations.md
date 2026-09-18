# Capability: Team Invitations & Onboarding Flow (invitations)

## Purpose
Enables organization administrators to invite new colleagues via email with secure tokens, role pre-assignment, and automated team onboarding.

## Functional Requirements
- Admin invites new or existing user by email address, specifying initial team role.
- Secure, cryptographically random invitation token with 7-day expiration.
- Email delivery containing personalized invitation link.
- Acceptance flow: existing user joins instantly; new user completes registration and joins team automatically.
- Invitation revoking and resending capabilities.

## Domain Objects
- `Invitation`: Pending team invitation record.

## Database Requirements
- Table `invitations`: `id` (UUID), `organization_id` (FK), `inviter_id` (FK), `email` (citext), `role` (string), `token_digest` (string, unique, indexed), `expires_at` (datetime), `accepted_at` (datetime), `created_at` (datetime).

## Backend Responsibilities
- `Tenancy::CreateInvitation` service generating tokens and queuing mailers.
- `Tenancy::AcceptInvitation` service converting invitation into a `Membership` in an atomic transaction.

## Authorization Requirements
- Only `owner` and `admin` can invite or revoke invitations.

## API Requirements
- `GET /api/v1/organizations/current/invitations` (list pending invitations).
- `POST /api/v1/organizations/current/invitations` (send new invitation).
- `DELETE /api/v1/organizations/current/invitations/:id` (revoke invitation).
- `POST /api/v1/invitations/:token/accept` (accept invitation).

## ActiveAdmin Requirements
- Resource `Invitation`: View pending and expired invitations across organizations.

## Customer Frontend Requirements
- "Invite Member" modal dialog in Team Settings; public invitation acceptance landing page.

## Background Jobs
- `Tenancy::SendInvitationEmailJob`: Dispatches invitation email.

## Events
- `invitation.sent`, `invitation.accepted`, `invitation.revoked`.

## Webhooks
- `team.invitation_sent`, `team.invitation_accepted`.

## Telemetry
- Track `team.invitation_sent`, `team.invitation_conversion_rate`.

## Observability
- Metrics: invitation acceptance rate, median time to accept.

## Security Requirements
- Tokens stored as SHA-256 digests; expired tokens rejected immediately.
- Rate limiting on invitation dispatch to prevent spam.

## Failure Modes
- Expired token -> Redirect to login with `INVITATION_EXPIRED` message.

## Required Tests
- Service specs: token creation, expiration check, conversion to membership.
- Request specs: authorization checks for inviting users.

## Acceptance Criteria
- 100% token safety with zero plaintext tokens stored in database.

## Definition of Done
- Rails `Invitation` model, mailer, controller, and Next.js invitation acceptance view verified.

## LastSaaS Evidence
- `backend/internal/models/invitation.go`, `backend/internal/api/handlers/tenant.go`.

## Golden Stack Adaptation
- Rails `Invitation` model + `ActionMailer` + Sidekiq delivery.

## Optional / Product-specific Extensions
- Domain-based auto-join (e.g. any `@company.com` email automatically joins without explicit invite).
