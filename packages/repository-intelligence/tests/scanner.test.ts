import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RepositoryScanner, ProductWorkspaceScanner } from "../src/scanner.js";
import { RepositoryRootValidator } from "../src/validator/repository-root-validator.js";
import { SecretDetector } from "../src/security/secret-detector.js";
import { UnsafeFilePolicy } from "../src/security/unsafe-file-policy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MINIMAL_RAILS_DIR = path.resolve(__dirname, "../fixtures/minimal-rails");
const RAILS_NEXT_SAAS_DIR = path.resolve(__dirname, "../fixtures/rails-next-saas");
const NESTED_RAILS_NEXT_DIR = path.resolve(__dirname, "../fixtures/nested-rails-next");
const INVALID_ROOT_DIR = path.resolve(__dirname, "../fixtures/invalid-root");

describe("Repository Intelligence Scanner", () => {
  describe("RepositoryRootValidator", () => {
    it("validates a single-app Rails root", async () => {
      const res = await RepositoryRootValidator.validate(MINIMAL_RAILS_DIR);
      expect(res.status).toBe("VALID");
      expect(res.workspace_type).toBe("SINGLE_APP");
      expect(res.backend_roots.length).toBe(1);
      expect(res.evidence.length).toBeGreaterThan(0);
    });

    it("validates a monorepo / nested back & front workspace (backend/ + frontend/)", async () => {
      const res = await RepositoryRootValidator.validate(RAILS_NEXT_SAAS_DIR);
      expect(res.status).toBe("VALID");
      expect(res.workspace_type).toBe("NESTED_BACK_FRONT");
      expect(res.backend_roots.length).toBeGreaterThanOrEqual(1);
      expect(res.frontend_roots.length).toBeGreaterThanOrEqual(1);
    });

    it("validates custom nested app structures like AB0-1-back and AB0-1-front", async () => {
      const res = await RepositoryRootValidator.validate(NESTED_RAILS_NEXT_DIR);
      expect(res.status).toBe("VALID");
      expect(res.workspace_type).toBe("NESTED_BACK_FRONT");
      expect(res.backend_roots.some((r) => r.includes("AB0-1-back"))).toBe(true);
      expect(res.frontend_roots.some((r) => r.includes("AB0-1-front"))).toBe(true);
    });

    it("returns NOT_VERIFIED for directories lacking Rails or Next.js components", async () => {
      const res = await RepositoryRootValidator.validate(INVALID_ROOT_DIR);
      expect(res.status).toBe("NOT_VERIFIED");
      expect(res.workspace_type).toBe("UNKNOWN");
      expect(res.backend_roots.length).toBe(0);
      expect(res.frontend_roots.length).toBe(0);
      expect(res.reason).toContain("No detectable Rails or Next.js");
    });
  });

  describe("ProductWorkspaceScanner", () => {
    it("scans a full ProductWorkspace with separate backend and frontend apps", async () => {
      const workspace = await ProductWorkspaceScanner.scanWorkspace(RAILS_NEXT_SAAS_DIR);
      expect(workspace.validation.status).toBe("VALID");
      expect(workspace.backendRoots.length).toBeGreaterThanOrEqual(1);
      expect(workspace.frontendRoots.length).toBeGreaterThanOrEqual(1);
      
      const backendManifest = workspace.manifests["backend"];
      expect(backendManifest).toBeDefined();
      expect(backendManifest?.stack.backend).toBe("rails");
      expect(backendManifest?.backend.models.some((m) => m.name === "Mission")).toBe(true);
      expect(backendManifest?.tests.specCount).toBeGreaterThanOrEqual(3);

      const frontendManifest = workspace.manifests["frontend"];
      expect(frontendManifest).toBeDefined();
      expect(frontendManifest?.stack.frontend).toBe("nextjs");
      expect(frontendManifest?.frontend.routes.length).toBeGreaterThanOrEqual(2);
    });

    it("returns an empty manifest with NOT_VERIFIED status when scanning an invalid workspace", async () => {
      const workspace = await ProductWorkspaceScanner.scanWorkspace(INVALID_ROOT_DIR);
      expect(workspace.validation.status).toBe("NOT_VERIFIED");
      expect(Object.keys(workspace.manifests).length).toBe(0);
    });
  });

  describe("ScanCoverage and Spec Mapping", () => {
    it("reports scan coverage metrics accurately", async () => {
      const manifest = await RepositoryScanner.scan(MINIMAL_RAILS_DIR);
      expect(manifest.scanCoverage).toBeDefined();
      expect(manifest.scanCoverage.files_discovered).toBeGreaterThan(0);
      expect(manifest.scanCoverage.files_scanned).toBeGreaterThan(0);
      expect(manifest.scanCoverage.coverage_confidence).toBe("HIGH");
    });

    it("maps RSpec test files to target architecture components", async () => {
      const manifest = await RepositoryScanner.scan(path.join(RAILS_NEXT_SAAS_DIR, "backend"));
      expect(manifest.tests.specCount).toBeGreaterThanOrEqual(3);
      const missionSpec = manifest.tests.specs?.find((s) => s.targetComponent?.includes("Mission"));
      expect(missionSpec).toBeDefined();
      expect(missionSpec?.evidence.evidence_type).toBe("TEST");
    });
  });

  describe("Security & Redaction", () => {
    it("detects and redacts hardcoded secrets", () => {
      const line = `STRIPE_SECRET_KEY = "${["sk", "live", "51M00000000000000000000000"].join("_")}"`;
      const finding = SecretDetector.scanLine(line, 12, "config/initializers/stripe.rb");

      expect(finding).not.toBeNull();
      expect(finding?.type).toBe("stripe_secret");
      expect(finding?.redactedValue).toBe("[REDACTED_SECRET]");
      expect(finding?.redactedValue).not.toContain("sk_live");
    });

    it("enforces safe workspace paths and blocks traversals", () => {
      expect(UnsafeFilePolicy.isSafePath(path.join(MINIMAL_RAILS_DIR, "Gemfile"), MINIMAL_RAILS_DIR)).toBe(true);
      expect(UnsafeFilePolicy.isSafePath(path.join(MINIMAL_RAILS_DIR, "../../etc/passwd"), MINIMAL_RAILS_DIR)).toBe(false);
      expect(UnsafeFilePolicy.isSafePath(path.join(MINIMAL_RAILS_DIR, ".ssh/id_rsa"), MINIMAL_RAILS_DIR)).toBe(false);
    });

    it("properly flags ignored directory segments", () => {
      expect(UnsafeFilePolicy.isIgnored("/repo/node_modules/package.json")).toBe(true);
      expect(UnsafeFilePolicy.isIgnored("/repo/vendor/bundle/ruby/3.3.0/gem.rb")).toBe(true);
      expect(UnsafeFilePolicy.isIgnored("/repo/.git/HEAD")).toBe(true);
      expect(UnsafeFilePolicy.isIgnored("/repo/app/models/user.rb")).toBe(false);
    });
  });
});
