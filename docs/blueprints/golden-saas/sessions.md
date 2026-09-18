# Capability: Stateful Session Management & Revocation (sessions)

## Purpose
Provides secure, trackable user sessions with IP and user-agent metadata, activity tracking, individual device revocation, and bulk session termination across the entire system.

## Functional Requirements
- Stateful session creation on login with unique cryptographically secure session tokens.
- Tracking of IP address, parsed User-Agent (OS, browser, device type), and `last_active_at`.
- Remote single-session revocation (e.g. logging out a stolen phone).
- Bulk session revocation (e.g. "Log out all other devices").
- Automatic session invalidation upon password modification or account lock.

## Domain Objects
- `Session` / `UserSession`: Stateful login session record.

## Database Requirements
- Table `sessions`: `id` (UUID), `user_id` (FK, indexed), `token_digest` (string, unique, indexed), `ip_address` (inet), `user_agent` (string), `last_active_at` (datetime), `expires_at` (datetime), `revoked_at` (datetime).

## Backend Responsibilities
- Session creation on authentication success.
- Session validation in request middleware (`SetCurrentUserFromSession`).
- Token rotation and session expiry cleanup.

## Authorization Requirements
- Users can view and revoke only their own sessions.

## API Requirements
- `GET /api/v1/auth/sessions` (list active sessions for current user).
- `DELETE /api/v1/auth/sessions/:id` (revoke specified session).
- `POST /api/v1/auth/sessions/revoke_others` (revoke all sessions except current).

## ActiveAdmin Requirements
- Display active session count in `User` backoffice view with "Force Logout All" action button.

## Customer Frontend Requirements
- Security Settings page: Device & Session list with icons (Desktop, Mobile), location estimate, and "Revoke" button.

## Background Jobs
- `Sessions::PurgeExpiredSessionsJob`: Nightly deletion of sessions expired or revoked $> 30$ days ago.

## Events
- `session.created`, `session.revoked`, `session.bulk_revoked`.

## Webhooks
- `auth.session_revoked`.

## Telemetry
- Track `session.count_by_device_type`, `session.duration_hours`.

## Observability
- Metrics: active session gauge, revocation frequency.

## Security Requirements
- Tokens stored strictly as SHA-256 digests (`Digest::SHA256.hexdigest`).
- Revoked sessions return `401 Unauthorized` immediately on subsequent requests.

## Failure Modes
- Expired session -> Returns `401 Unauthorized` with `SESSION_EXPIRED` error code.

## Required Tests
- Model specs: token digest hashing, revocation timestamp setting.
- Request specs: list sessions, revoke single session, revoke others.

## Acceptance Criteria
- Revoked session token rejected on the very next HTTP request.
- Password change revokes all existing sessions automatically.

## Definition of Done
- Rails `Session` model, middleware concern, API endpoints, ActiveAdmin button, Next.js UI, and tests passed.

## LastSaaS Evidence
- `backend/internal/auth/ua_parser.go`, `backend/internal/api/handlers/auth.go` (session management & bulk revocation).

## Golden Stack Adaptation
- Rails ActiveRecord `Session` model with SHA-256 token digest and User-Agent parsing via `browser` gem.

## Optional / Product-specific Extensions
- GeoIP lookup for approximate city/country display in session list.
