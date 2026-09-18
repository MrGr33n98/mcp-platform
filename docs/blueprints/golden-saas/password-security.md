# Capability: Password Security, Hashing & Timing-Safe Verification (password-security)

## Purpose
Defines password complexity standards, timing-safe verification mechanisms, secure bcrypt parameterization, account lockout policies, and single-use hashed password reset tokens.

## Functional Requirements
- Password entropy enforcement: minimum 12 characters, uppercase, lowercase, numbers, and symbols.
- Bcrypt hashing with cost factor 12.
- Timing-safe login comparisons (dummy bcrypt calculation on non-existent user email to block username enumeration).
- Password reset flow using short-lived (30 minutes) SHA-256 hashed single-use tokens.
- Account lockout after 5 consecutive failed attempts (15-minute cooldown or unlock email).
- Password mutation immediately revokes all active sessions.

## Domain Objects
- `PasswordResetToken`: Short-lived single-use token record.

## Database Requirements
- Table `users`: `failed_attempts` (integer, default: 0), `locked_at` (datetime), `password_reset_token_digest` (string), `password_reset_sent_at` (datetime).

## Backend Responsibilities
- `Auth::VerifyPassword` service executing timing-safe checks.
- `Auth::RequestPasswordReset` generating random token and storing only its SHA-256 digest.

## Authorization Requirements
- Public password reset request endpoint; resets require possession of valid token.

## API Requirements
- `POST /api/v1/auth/password/reset_request` (trigger reset email).
- `POST /api/v1/auth/password/reset_confirm` (provide token and new password).
- `PATCH /api/v1/auth/password/change` (authenticated password update).

## ActiveAdmin Requirements
- Unlock locked accounts, send password reset link to user.

## Customer Frontend Requirements
- Password strength meter on signup/reset forms; "Forgot Password" flow.

## Background Jobs
- `Auth::SendPasswordResetEmailJob`: Dispatches password reset link.

## Events
- `password.reset_requested`, `password.changed`, `user.account_locked`.

## Webhooks
- `security.password_changed`.

## Telemetry
- Track `auth.failed_password_attempts`, `auth.lockout_events`.

## Observability
- Rate of account lockouts, password reset volume.

## Security Requirements
- Tokens must expire after 30 minutes.
- Hashed token comparison in constant time (`ActiveSupport::SecurityUtils.secure_compare`).

## Failure Modes
- Expired token -> Return `400 Bad Request` with `TOKEN_EXPIRED`.

## Required Tests
- Unit specs: timing difference between existing and non-existing email verification is negligible.
- Request specs: 5 failed logins triggers account lockout.

## Acceptance Criteria
- Zero account enumeration vulnerabilities.
- Reset token cannot be reused after successful password reset.

## Definition of Done
- Rails security services, Devise/custom authentication config, Next.js reset pages, and tests verified.

## LastSaaS Evidence
- `backend/internal/auth/password.go`, `password_test.go`.

## Golden Stack Adaptation
- Rails `has_secure_password` / `bcrypt` + `ActiveSupport::SecurityUtils.secure_compare`.

## Optional / Product-specific Extensions
- Integration with HaveIBeenPwned API to block compromised passwords.
