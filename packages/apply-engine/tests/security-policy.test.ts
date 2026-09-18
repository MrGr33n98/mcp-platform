import { describe, it, expect } from "vitest";
import { PathPolicy } from "../src/security/path-policy.js";
import { FilePolicy } from "../src/security/file-policy.js";
import { SecretPolicy } from "../src/security/secret-policy.js";
import { MutationPolicy } from "../src/security/mutation-policy.js";

describe("Apply Engine Security Policies (Phase 5G)", () => {
  const workspaceRoot = "C:/Users/Bobi/Desktop/mcp-platform/test_workspace";

  it("blocks path traversal and outside workspace escapes (PATH OUTSIDE WORKSPACE → NO APPLY)", () => {
    expect(PathPolicy.validatePath(workspaceRoot, "../outside.rb").valid).toBe(false);
    expect(PathPolicy.validatePath(workspaceRoot, "app/../../outside.rb").valid).toBe(false);
    expect(PathPolicy.validatePath(workspaceRoot, "/etc/passwd").valid).toBe(false);
    expect(PathPolicy.validatePath(workspaceRoot, "C:/Windows/System32/calc.exe").valid).toBe(false);
    expect(PathPolicy.validatePath(workspaceRoot, "app/models/webhook.rb").valid).toBe(true);
  });

  it("blocks protected configuration and secret files (NO WRITE to .env, master.key, *.pem)", () => {
    expect(FilePolicy.isProtectedFile(".env").protected).toBe(true);
    expect(FilePolicy.isProtectedFile(".env.production").protected).toBe(true);
    expect(FilePolicy.isProtectedFile("config/master.key").protected).toBe(true);
    expect(FilePolicy.isProtectedFile("config/credentials.yml.enc").protected).toBe(true);
    expect(FilePolicy.isProtectedFile("id_rsa").protected).toBe(true);
    expect(FilePolicy.isProtectedFile("server.key").protected).toBe(true);
    expect(FilePolicy.isProtectedFile("cert.pem").protected).toBe(true);
    expect(FilePolicy.isProtectedFile(".git/config").protected).toBe(true);

    expect(FilePolicy.isProtectedFile("app/models/user.rb").protected).toBe(false);
  });

  it("blocks unmasked raw live secrets in mutation contents", () => {
    const rawStripeSecret = `const key = '${["sk", "live", "1234567890123456789012345678"].join("_")}';`;
    expect(SecretPolicy.containsRawLiveSecret(rawStripeSecret).hasSecret).toBe(true);

    const rawGhpToken = `const token = '${["ghp", "123456789012345678901234567890123456"].join("_")}';`;
    expect(SecretPolicy.containsRawLiveSecret(rawGhpToken).hasSecret).toBe(true);

    const safeCode = "class WebhookEndpoint < ApplicationRecord\n  belongs_to :organization\nend";
    expect(SecretPolicy.containsRawLiveSecret(safeCode).hasSecret).toBe(false);
  });

  it("blocks DELETE_FILE and RENAME_FILE mutations in Phase 5G baseline", () => {
    expect(MutationPolicy.validateMutationType("CREATE_FILE").allowed).toBe(true);
    expect(MutationPolicy.validateMutationType("MODIFY_FILE").allowed).toBe(true);
    expect(MutationPolicy.validateMutationType("PATCH_FILE").allowed).toBe(true);
    expect(MutationPolicy.validateMutationType("DELETE_FILE").allowed).toBe(false);
    expect(MutationPolicy.validateMutationType("RENAME_FILE").allowed).toBe(false);
  });
});
