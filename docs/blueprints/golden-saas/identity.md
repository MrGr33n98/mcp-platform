# Capability: Identity Subject & User Profile Model (identity)

## Purpose
Establishes the fundamental identity subject (`User`), profile attributes, global states (active, suspended, locked), and identity lifecycle hooks across the multi-tenant SaaS ecosystem.

## Functional Requirements
- Unique global email address with case-insensitive uniqueness (`citext`).
- User profile attributes (name, avatar, locale, timezone, theme preference).
- Identity lifecycle states (pending verification, active, locked, soft-deleted).
- Account closure and GDPR/LGPD compliant data export and erasure routines.

## Domain Objects
- `User`: Primary identity entity.
- `UserProfile`: Extended profile data (preferences, bio, location).

## Database Requirements
- Table `users`: `id` (UUID), `email` (citext, unique, indexed), `encrypted_password` (string), `name` (string), `locale` (string, default: 'en'), `timezone` (string, default: 'UTC'), `created_at` (datetime).

## Backend Responsibilities
- User registration and lifecycle state machines (`aasm` or Rails enum).
- Identity normalization (email downcasing and trimming).

## Authorization Requirements
- Users may read and update only their own profile.
- System SuperAdmins may view user metadata and lock accounts via backoffice.

## API Requirements
- `GET /api/v1/user/profile` (current authenticated user profile).
- `PATCH /api/v1/user/profile` (update profile details).
- `DELETE /api/v1/user/account` (initiate account deletion).

## ActiveAdmin Requirements
- Resource `User`: View verification state, lock/unlock, view joined organizations.

## Customer Frontend Requirements
- User profile settings screen (avatar upload, name, timezone, locale, theme toggle).

## Background Jobs
- `Identity::ProcessAccountDeletionJob`: Cascade soft-deletion and scrubbing of personal data.

## Events
- `identity.created`, `identity.updated`, `identity.locked`, `identity.deleted`.

## Webhooks
- `user.created`, `user.deleted`.

## Telemetry
- Track `user.profile_updated`, `user.account_deleted`.

## Observability
- Metric `users.active_count`, `users.registration_rate`.

## Security Requirements
- PII minimization in logs and telemetry payloads.
- Account deletion requires re-authentication confirmation.

## Failure Modes
- Database connection failure -> Standard Rails 500 error response.

## Required Tests
- Model specs: email format validation, uniqueness, lifecycle state transitions.
- Request specs: profile read/update authorization.

## Acceptance Criteria
- 100% case-insensitive email uniqueness.
- Zero plaintext PII leaked in server logs.

## Definition of Done
- Rails models, migration, controllers, Pundit policies, and frontend settings views verified.

## LastSaaS Evidence
- `backend/internal/models/user.go`, `backend/internal/api/handlers/auth.go`.

## Golden Stack Adaptation
- Rails 8 `User` ActiveRecord model with `has_secure_password` / Devise + ActiveStorage avatar attachment.

## Optional / Product-specific Extensions
- Integration with Gravatar / Clearbit for automatic avatar resolution.
