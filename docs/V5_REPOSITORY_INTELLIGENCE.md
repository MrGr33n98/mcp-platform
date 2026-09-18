# V5 — Repository Intelligence Specification

**Package:** `@mcp-platform/repository-intelligence`  
**Execution Mode:** Purely READ-ONLY  
**Target:** Local repositories and monorepos

---

## 1. Objectives

Inspects software repositories without mutating files, executing untrusted scripts, or running arbitrary shell commands. Produces a structured `RepositoryManifest` documenting stacks, versions, models, controllers, policies, routes, admin resources, background jobs, infra, and security findings.

---

## 2. Detectors & Parsers Architecture

```text
packages/repository-intelligence/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── scanner.ts
│   ├── detectors/
│   │   ├── rails.ts
│   │   ├── nextjs.ts
│   │   └── infra.ts
│   ├── parsers/
│   │   ├── rails-routes.ts
│   │   ├── rails-schema.ts
│   │   ├── rails-model.ts
│   │   ├── rails-controller.ts
│   │   ├── rails-policy.ts
│   │   ├── rails-service.ts
│   │   ├── rails-job.ts
│   │   ├── active-admin.ts
│   │   └── next-route.ts
│   └── security/
│       ├── secret-detector.ts
│       └── unsafe-file-policy.ts
```

---

## 3. Security & Safety Invariants

- **Path Traversal Guard:** All paths are resolved and checked against the repository root.
- **Secret Redaction:** Patterns matching API keys, JWT secrets, Stripe keys, and passwords are automatically redacted (`[REDACTED_SECRET]`).
- **Ignored Segments:** Standard skip rules for `node_modules/`, `vendor/bundle/`, `.git/`, `.next/`, `tmp/`, `storage/`, and large binary files.
