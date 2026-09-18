# V5 — Security Model & Threat Mitigation

**Scope:** Golden SaaS Engineering Platform & Runtime MCP  
**Standard:** Enterprise DevSecOps & Zero-Trust Architecture

---

## 1. Threat Model & Protections

| Threat Vector | Mitigation Strategy | Evidence / Implementation |
|---|---|---|
| **Untrusted Repository Content** | All static scanners operate in strict read-only mode with path normalization. README instructions never override governance. | `UnsafeFilePolicy.isSafePath` |
| **Secret Exposure** | Automatic regex scanning and token redaction across all outputs, logs, and manifest files. | `SecretDetector.scanLine` |
| **Tenant Boundary Escape** | Tenant identity derived exclusively from authenticated credentials. Arbitrary `tenant_id` parameters rejected. | Verified in live Rails integration tests |
| **SSRF (Webhooks)** | Validation of outgoing webhook destination URLs against private IP ranges (`127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`). | Webhook specification & SSRF checker |
| **Tool Abuse & High-Risk Mutations** | High-risk operations require cryptographic proposal creation (SHA-256) and explicit human approval (HITL). | `ProposalEngine` |
| **Stored XSS in Branding** | User-provided CSS and HTML fields pass through DOMPurify and Rails HTML Sanitizer. | `Branding` capability specification |
| **Command Injection & Destructive Operations** | Shell commands categorized with destructive operations (`reset --hard`, `force push`, `clean -fd`) permanently blocked by default. | Command Execution Policy |

---

## 2. Command & Execution Policies

- `READ_ONLY`: Automated without review (Scanners, Graph Builders, Manifests).
- `SAFE_BUILD` & `SAFE_TEST`: Automated in CI and local test runner.
- `MIGRATION` & `GIT_WRITE`: Requires explicit human review (`HITL`).
- `DESTRUCTIVE`: Prohibited by default.
