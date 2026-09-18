import type { CIReceipt, CICheck } from "../types.js";

export interface CIProvider {
  name: string;
  fetchReceipt(commitSha: string, workflowName?: string): Promise<CIReceipt | null>;
}

export class FakeCIProvider implements CIProvider {
  public name = "FakeCIProvider";
  private receipts: Map<string, CIReceipt> = new Map();

  public registerReceipt(receipt: CIReceipt): void {
    this.receipts.set(receipt.commit_sha, receipt);
  }

  public async fetchReceipt(commitSha: string): Promise<CIReceipt | null> {
    return this.receipts.get(commitSha) ?? null;
  }

  public static createDefaultPassingReceipt(params: {
    commitSha: string;
    artifactDigest: string;
    repository?: string | undefined;
    workflow?: string | undefined;
    customChecks?: CICheck[] | undefined;
  }): CIReceipt {
    const checks: CICheck[] = params.customChecks ?? [
      { name: "rspec_unit_tests", status: "PASS", mandatory: true },
      { name: "zeitwerk_compliance", status: "PASS", mandatory: true },
      { name: "rubocop_lint", status: "PASS", mandatory: false },
      { name: "typescript_typecheck", status: "PASS", mandatory: true },
      { name: "contract_verification", status: "PASS", mandatory: true },
      { name: "docker_build_digest", status: "PASS", mandatory: true }
    ];

    return {
      schema_version: 1,
      ci_run_id: `ci_run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      provider: "github_actions",
      repository: params.repository ?? "MrGr33n98/oest-backend",
      commit_sha: params.commitSha,
      workflow: params.workflow ?? "Release CI & Image Build",
      started_at: new Date(Date.now() - 120000).toISOString(),
      finished_at: new Date().toISOString(),
      status: "PASS",
      checks,
      artifact_digests: [params.artifactDigest],
      provenance: {
        trigger_event: "push",
        branch: "main",
        actor: "mcp-governance"
      }
    };
  }
}
