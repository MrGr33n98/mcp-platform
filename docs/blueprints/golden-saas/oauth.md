# Capability: Third-Party OAuth Social Authentication (oauth)

## Purpose
Enables users to sign in and register using third-party identity providers (Google, GitHub, Microsoft) with automatic email matching and account linking.

## Functional Requirements
- OAuth 2.0 / OpenID Connect authorization code flow.
- Providers: Google, GitHub, Microsoft Azure AD.
- Automatic account reconciliation (if email exists and is verified, link OAuth provider).
- Profile picture and display name pre-fill from provider.

## Domain Objects
- `OauthIdentity`: Linked third-party provider identity.

## Database Requirements
- Table `oauth_identities`: `id` (UUID), `user_id` (FK), `provider` (string), `uid` (string), `email` (string), `created_at` (datetime). Unique index on `[provider, uid]`.

## Backend Responsibilities
- `omniauth` or custom OAuth 2.0 client exchange.
- State parameter validation to prevent CSRF during OAuth callback.
- Linking or creating `User` in an atomic database transaction.

## Authorization Requirements
- Public callback endpoints; users can unlink secondary OAuth providers from their settings.

## API Requirements
- `GET /api/v1/auth/oauth/:provider` (redirects to provider login).
- `POST /api/v1/auth/oauth/:provider/callback` (exchanges authorization code).
- `DELETE /api/v1/auth/oauth/:provider` (unlink provider).

## ActiveAdmin Requirements
- View linked OAuth providers per user.

## Customer Frontend Requirements
- Social login buttons on Login and Signup pages.
- "Connected Accounts" section in User Security settings.

## Events
- `oauth.connected`, `oauth.unlinked`, `oauth.login`.

## Webhooks
- `auth.oauth_linked`.

## Telemetry
- Track `auth.oauth_provider_breakdown`.

## Observability
- Provider error rates, OAuth callback response times.

## Security Requirements
- CSRF `state` parameter validation mandatory.
- Provider access tokens not stored permanently unless needed for downstream API calls.

## Failure Modes
- Provider unreachable -> Redirect to login with `OAUTH_PROVIDER_ERROR` notice.

## Required Tests
- Service specs: OAuth callback handling with mocked provider responses (Google, GitHub, Microsoft).
- Request specs: Account linking logic for existing vs new email.

## Acceptance Criteria
- 100% CSRF protection via state parameter.
- Seamless linking without duplicate user accounts.

## Definition of Done
- Rails OAuth controller, `OauthIdentity` model, Next.js social buttons, and tests verified.

## LastSaaS Evidence
- `backend/internal/auth/google_oauth.go`, `github_oauth.go`, `microsoft_oauth.go`, `oauth_test.go`.

## Golden Stack Adaptation
- Rails 8 `omniauth-google-oauth2`, `omniauth-github`, `omniauth-microsoft_graph`.

## Optional / Product-specific Extensions
- Enterprise SAML SSO (Okta, OneLogin).
