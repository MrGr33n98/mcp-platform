import type { DeploymentPlan, DeploymentStep } from "../types.js";

export class DeploymentReportGenerator {
  public static generatePlanSummary(plan: DeploymentPlan): string {
    const lines: string[] = [];
    lines.push(`### Deployment Plan \`${plan.plan_id}\``);
    lines.push(`- **Target:** \`${plan.target.product}\` / \`${plan.target.environment}\` / \`${plan.target.service}\``);
    lines.push(`- **Strategy:** \`${plan.strategy}\``);
    lines.push(`- **Artifact Digest:** \`${plan.artifact.digest}\``);
    lines.push(`- **Timeout:** ${plan.timeout_ms / 1000}s`);
    lines.push("");
    lines.push("**Steps:**");
    for (const step of plan.steps) {
      lines.push(`- \`${step.step_id}\`: ${step.name} (${step.action_type}) [timeout: ${step.timeout_ms / 1000}s]`);
    }
    return lines.join("\n");
  }
}
