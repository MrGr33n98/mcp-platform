import { describe, it, expect } from "vitest";
import { DiffParser } from "../src/diff/diff-parser.js";
import { DiffClassifier } from "../src/diff/diff-classifier.js";
import { StagingManager } from "../src/git/staging-manager.js";
import { GitSecurityViolationError } from "../src/security/git-command-policy.js";

describe("Selective Staging & Diff Classification", () => {
  it("parses unified diffs with added and removed lines", () => {
    const rawDiff = `
diff --git a/app/models/user.rb b/app/models/user.rb
index 1234567..89abcdef 100644
--- a/app/models/user.rb
+++ b/app/models/user.rb
@@ -10,2 +10,3 @@
-  has_many :posts
+  has_many :posts, dependent: :destroy
+  has_many :webhooks
`;

    const parsed = DiffParser.parse(rawDiff);
    expect(parsed.length).toBe(1);
    expect(parsed[0]?.newPath).toBe("app/models/user.rb");
    expect(parsed[0]?.linesAdded).toBe(2);
    expect(parsed[0]?.linesRemoved).toBe(1);
  });

  it("classifies diff files as EXPECTED when in plan and UNEXPECTED when not in plan", () => {
    const rawDiff = `
diff --git a/app/models/webhook.rb b/app/models/webhook.rb
new file mode 100644
--- /dev/null
+++ b/app/models/webhook.rb
@@ -0,0 +1,2 @@
+class Webhook < ApplicationRecord
+end
diff --git a/unrelated_file.rb b/unrelated_file.rb
new file mode 100644
--- /dev/null
+++ b/unrelated_file.rb
@@ -0,0 +1,2 @@
+# unintended modification
`;

    const parsed = DiffParser.parse(rawDiff);
    const report = DiffClassifier.classifyDiff(
      parsed,
      ["app/models/webhook.rb"],
      rawDiff
    );

    expect(report.files.length).toBe(2);
    expect(report.files.find(f => f.path === "app/models/webhook.rb")?.classification).toBe("EXPECTED");
    expect(report.files.find(f => f.path === "unrelated_file.rb")?.classification).toBe("UNEXPECTED");
    expect(report.is_consistent_with_plan).toBe(false);
    expect(report.unclassified_or_unexpected).toContain("unrelated_file.rb");
  });

  it("StagingManager rejects wildcard attempts", async () => {
    const mockGit = {
      addExplicitFiles: async () => {},
    } as any;

    const mgr = new StagingManager(mockGit);
    await expect(mgr.stageDeclaredFiles([])).rejects.toThrow(GitSecurityViolationError);
    await expect(mgr.stageDeclaredFiles(["."])).rejects.toThrow(GitSecurityViolationError);
    await expect(mgr.stageDeclaredFiles(["*"])).rejects.toThrow(GitSecurityViolationError);
    await expect(mgr.stageDeclaredFiles(["app/*"])).rejects.toThrow(GitSecurityViolationError);
  });
});
