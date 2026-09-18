# Capability: Multi-Factor Authentication & Recovery Codes (mfa)

## Purpose
Provides secondary authentication factors (TOTP via RFC 6238 and WebAuthn Passkeys) along with high-entropy recovery codes to secure user accounts against credential theft.

## Functional Requirements
- TOTP secret generation, QR code rendering, and verification flow.
- 16-byte cryptographically secure one-time backup recovery codes (set of 8-10 codes).
- Mandatory MFA challenge step on login when enabled.
- Rate limiting on MFA validation attempts (maximum 3 failed attempts per challenge).
- MFA disablement flow requiring active password and OTP confirmation.

## Domain Objects
- `MfaCredential`: Encrypted TOTP secret and hashed backup codes.

## Database Requirements
- Table `mfa_credentials`: `id` (UUID), `user_id` (FK, unique), `credential_type` (string: 'totp', 'webauthn'), `encrypted_secret` (string), `backup_codes_digests` (text[]), `created_at` (datetime).

## Backend Responsibilities
- TOTP verification using `rotp` gem.
- Encryption of secrets at rest via `ActiveRecord::Encryption`.
- Single-use consumption and removal of backup codes when used.

## Authorization Requirements
- Only authenticated user can initiate MFA setup or view newly generated backup codes.

## API Requirements
- `POST /api/v1/auth/mfa/setup` (generate secret and QR code URI).
- `POST /api/v1/auth/mfa/enable` (confirm code and activate MFA, returns recovery codes).
- `POST /api/v1/auth/mfa/challenge` (complete login with OTP or recovery code).
- `POST /api/v1/auth/mfa/disable` (deactivate MFA).

## ActiveAdmin Requirements
- View MFA enablement status on User record; admin action to issue emergency MFA reset with audit log.

## Customer Frontend Requirements
- Multi-step MFA setup wizard (QR code scan, test code verification, recovery codes download/copy modal).
- Login MFA challenge step with fallback to "Use recovery code".

## Background Jobs
- `Mfa::SendMfaDisabledAlertJob`: Email warning user when MFA is disabled.

## Events
- `mfa.enabled`, `mfa.disabled`, `mfa.challenged`, `mfa.recovery_code_used`.

## Webhooks
- `security.mfa_status_changed`.

## Telemetry
- Track `mfa.enrollment_rate`, `mfa.challenge_failure_rate`.

## Observability
- Metric `mfa.active_users_percentage`.

## Security Requirements
- Recovery codes hashed with SHA-256 before storage.
- Rate limit of 3 attempts per challenge window.

## Failure Modes
- Lost device + lost codes -> Requires support-assisted identity verification and manual reset.

## Required Tests
- Service specs: TOTP time-window drift check, backup code single-use destruction.
- Request specs: rate limiting on 3 invalid codes, challenge verification with JWT generation.

## Acceptance Criteria
- 100% encrypted secrets at rest.
- Consumed recovery code cannot be reused.

## Definition of Done
- Rails `rotp` integration, database encryption, API endpoints, ActiveAdmin audit, Next.js UI, and tests passed.

## LastSaaS Evidence
- `backend/internal/auth/totp.go`, `backend/internal/models/webauthn_credential.go`.

## Golden Stack Adaptation
- Rails 8 ActiveRecord encryption + `rotp` gem + `rqrcode` for QR code generation.

## Optional / Product-specific Extensions
- FIDO2 / WebAuthn biometric passkeys.
