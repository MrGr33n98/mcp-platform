# Capability: Multi-Tenant Authentication & Identity (Identity, Authentication, Sessions, MFA, OAuth, Password Security)

## Purpose
Provides secure, timing-safe user authentication, multi-factor authentication (TOTP/WebAuthn), social OAuth integration, session lifecycle management, and password security policies across tenants.

## Functional Requirements
- Email/password authentication with bcrypt hashing (`cost: 12`).
- Timing-safe login comparisons to mitigate account enumeration.
- Social OAuth authentication (Google, GitHub, Microsoft) with automatic account reconciliation.
- Multi-factor authentication via TOTP (RFC 6238) and WebAuthn / Passkeys.
- 16-byte cryptographically secure MFA recovery codes.
- Stateful session tracking with remote and bulk revocation capabilities.
- Password reset workflows with hashed, short-lived (30m) single-use tokens.
- Account lockout policy after repeated failed attempts.

## Domain Objects
- `User`: Primary identity subject.
- `Session` / `UserSession`: Active login session with IP, User-Agent, and last active timestamp.
- `MfaCredential`: TOTP secret, backup codes, or WebAuthn public key credential.
- `OauthIdentity`: Linked third-party OAuth profile (provider, uid, email).
- `PasswordResetToken`: SHA-256 hashed password reset token record.

## Database Requirements
- Table `users`: `id` (UUID), `email` (citext, unique), `encrypted_password` (string), `failed_attempts` (integer), `locked_at` (datetime), `mfa_enabled` (boolean).
- Table `sessions`: `id` (UUID), `user_id` (FK), `token_digest` (string, indexed), `ip_address` (inet), `user_agent` (string), `expires_at` (datetime), `revoked_at` (datetime).
- Table `mfa_credentials`: `id` (UUID), `user_id` (FK), `credential_type` (string), `encrypted_secret` (string), `backup_codes_digest` (jsonb).
- Table `oauth_identities`: `id` (UUID), `user_id` (FK), `provider` (string), `uid` (string, unique per provider).

## Backend Responsibilities
- Secure authentication services (`Auth::Authenticate`, `Auth::Register`, `Auth::RevokeSessions`).
- Devise / custom JWT / Rodauth adapter integration.
- Automated session invalidation on password mutation.
- Dummy bcrypt calculation when user email is not found to prevent timing attacks.

## Authorization Requirements
- Unauthenticated users may only access `/auth/*` endpoints.
- Authenticated users may manage only their own sessions and credentials.
- System admins cannot view user plaintext passwords or MFA secrets.

## API Requirements
- `POST /api/v1/auth/login` (email/password -> session/JWT).
- `POST /api/v1/auth/mfa/challenge` (TOTP validation).
- `POST /api/v1/auth/logout` (scoped session revocation).
- `POST /api/v1/auth/logout_all` (revokes all active sessions).
- `GET /api/v1/auth/sessions` (list active sessions).
- `DELETE /api/v1/auth/sessions/:id` (revoke single session).

## ActiveAdmin Requirements
- ActiveAdmin resource `User`: View verification state, lock/unlock user, trigger password reset email, view active session counts (never expose secrets or hashes).

## Customer Frontend Requirements
- Next.js login, signup, password recovery, and MFA challenge pages.
- Account settings page for MFA enrollment (QR code display, recovery code modal) and active session management.

## Background Jobs
- `Auth::SendPasswordResetEmailJob`: Delivers password reset instructions.
- `Auth::SendEmailVerificationJob`: Delivers email confirmation links.
- `Auth::CleanupExpiredSessionsJob`: Nightly purge of expired sessions.

## Events
- `user.registered`, `user.authenticated`, `user.login_failed`, `user.locked`, `user.password_reset`, `user.mfa_enabled`, `session.revoked`.

## Webhooks
- Emits `user.registered` and `user.deleted` to authorized tenant endpoints.

## Telemetry
- Track `auth.login_success`, `auth.login_failure`, `auth.mfa_challenged`, `auth.oauth_connected`.

## Observability
- Metrics on failed login rates, MFA adoption rate, OAuth provider distribution, session duration percentiles.

## Security Requirements
- Passwords must meet minimum entropy (12+ chars, mixed charset).
- AES-256-GCM encryption for TOTP secrets at rest.
- Strict rate limiting on `/auth/*` (e.g. 5 req/min per IP on failure).

## Failure Modes
- OAuth provider outage -> Fallback to password or magic link.
- MFA device lost -> Recovery codes or admin-assisted reset with audit verification.
- Redis session cache disconnect -> Direct PostgreSQL session lookup fallback.

## Required Tests
- Model specs: password hashing, token expiration, MFA validation.
- Request specs: login matrix, invalid credentials timing check, rate limit enforcement, session revocation.
- Cross-tenant test: user from Tenant A cannot authenticate or impersonate Tenant B without explicit membership.

## Acceptance Criteria
- 100% timing-safe authentication.
- Zero plaintext secrets in database, logs, or API payloads.
- Active session termination works immediately across all client devices.

## Definition of Done
- Database migrations, ActiveRecord models, Pundit policies, Auth controllers, ActiveAdmin backoffice, and Next.js frontend pages implemented and verified with $>90\%$ test coverage.

## LastSaaS Evidence
- `backend/internal/auth/`: `jwt.go`, `password.go`, `totp.go`, `google_oauth.go`, `github_oauth.go`, `microsoft_oauth.go`, `ua_parser.go`.
- `backend/internal/api/handlers/auth.go`: 77KB implementation containing session revocation, timing-safe bcrypt dummy comparison, rate limiting with `Fly-Client-IP`, recovery code entropy (16 bytes).

## Golden Stack Adaptation
- Implement using Rails ActiveRecord + `bcrypt` + `devise-jwt` / `rodauth-rails`, storing encrypted credentials via Rails `encrypts :secret` with ActiveRecord encryption.

## Optional / Product-specific Extensions
- Passkey WebAuthn hardware keys for high-security enterprise SaaS.
- Custom enterprise SAML / SSO connections (Okta, Azure AD).
