import type { PRPlan, PRReport, PullRequestProvider } from "../types.js";

export class MockPullRequestProvider implements PullRequestProvider {
  public readonly name = "MockPullRequestProvider";
  public readonly createdPRs: Array<{ plan: PRPlan; report: PRReport }> = [];

  public async createPullRequest(plan: PRPlan): Promise<PRReport> {
    const prNumber = this.createdPRs.length + 101;
    const report: PRReport = {
      pr_id: `pr_${prNumber}`,
      pr_url: `https://github.com/mock-org/${plan.repository}/pull/${prNumber}`,
      pr_number: prNumber,
      provider: this.name,
      status: "CREATED",
      created_at: new Date().toISOString(),
    };

    this.createdPRs.push({ plan, report });
    return report;
  }
}
