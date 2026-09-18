# Capability: White-Labeling & Custom Branding (White-Label, Branding, Custom Domains, Themes)

## Purpose
Enables multi-tenant visual customization, white-labeling, custom logos, dynamic theme color schemes, typography selection, custom navigation links, Open Graph metadata, and optional custom domain support.

## Functional Requirements
- **Tenant Visual Customization:** Custom app title, tagline, logo (light/dark mode), favicon, and primary brand color.
- **Dynamic Theming:** Configurable HSL/hex color palettes applied across customer frontend and email templates.
- **Custom Navigation & Pages:** Tenant-specific navigation links, custom marketing landing pages, and customized authentication screens.
- **Safe HTML/CSS Injection:** Sanitized custom CSS/HTML for enterprise dashboards with strict XSS and DOMPurify filtering.
- **Server-Side Injection:** Zero-flicker server-side injection of branding metadata (title, favicon, theme color) on initial HTML render.

## Domain Objects
- `TenantBranding`: Visual identity and theming configuration.
- `CustomDomain`: SSL and DNS mapping entity for enterprise white-label domains.

## Database Requirements
- Table `tenant_brandings`: `id` (UUID), `organization_id` (FK, unique), `app_name` (string), `tagline` (string), `primary_color` (string), `accent_color` (string), `logo_url` (string), `dark_logo_url` (string), `favicon_url` (string), `custom_css` (text), `custom_html` (text), `created_at` (datetime), `updated_at` (datetime).
- Table `custom_domains`: `id` (UUID), `organization_id` (FK), `domain` (string, unique, indexed), `status` (enum: pending_verification, active, ssl_error), `dns_txt_record` (string), `verified_at` (datetime).

## Backend Responsibilities
- Branding middleware injecting tenant identity into response headers and view helpers.
- HTML and CSS sanitization via `Rails::Html::Sanitizer` / `Sanitize` gem before saving customization fields.
- Storage of uploaded brand assets in S3/Spaces via ActiveStorage.

## Authorization Requirements
- Only `Admin` or `Owner` roles can update organization branding.

## API Requirements
- `GET /api/v1/branding/current` (returns public branding for current hostname/slug).
- `PATCH /api/v1/organizations/current/branding` (update branding settings).
- `POST /api/v1/organizations/current/branding/logo` (upload logo asset).

## ActiveAdmin Requirements
- ActiveAdmin resource `TenantBranding`: Inspect and override tenant branding, preview custom CSS, disable abusive or offending styling.

## Customer Frontend Requirements
- Next.js Root Layout with dynamic CSS variables (`--primary`, `--accent`) derived from tenant branding.
- Branding settings tab in Organization Settings with live visual preview.

## Background Jobs
- `Branding::VerifyCustomDomainDnsJob`: Periodic DNS lookup verifying TXT records for custom domains.
- `Branding::IssueSslCertificateJob`: Automated Let's Encrypt SSL certificate provisioning.

## Events
- `branding.updated`, `custom_domain.verified`, `custom_domain.ssl_issued`.

## Webhooks
- Emits `branding.updated` on changes.

## Telemetry
- Track `branding.customized`, `branding.logo_uploaded`.

## Observability
- Asset storage bandwidth, SSL certificate expiry tracking.

## Security Requirements
- All user-supplied custom CSS and HTML must pass strict sanitization to prevent Stored XSS attacks.
- Disallow `javascript:` URIs in logo/favicon URLs.

## Failure Modes
- Asset storage unreachable -> Fallback to default platform logo and system theme.

## Required Tests
- Model specs: CSS sanitization tests, URL format validation.
- Request specs: Cross-tenant isolation on branding updates.

## Acceptance Criteria
- 100% protection against Stored XSS in branding HTML/CSS fields.
- Zero visual flicker during Next.js SSR page hydration.

## Definition of Done
- Rails models, ActiveStorage attachment, sanitization filters, ActiveAdmin resources, and Next.js dynamic theming components implemented and verified.

## LastSaaS Evidence
- `backend/internal/api/handlers/branding.go` (20KB).
- Models: `branding.go`.
- Frontend white-labeling and DOMPurify sanitization.

## Golden Stack Adaptation
- Implement using Rails ActiveStorage + `sanitize` gem + Next.js Tailwind CSS variables (`layout.tsx`).

## Optional / Product-specific Extensions
- Automated Let's Encrypt SSL provisioning via Caddy / Cloudflare for custom domains.
