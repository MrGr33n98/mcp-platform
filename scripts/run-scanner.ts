import fs from "node:fs/promises";
import path from "node:path";
import { RepositoryScanner } from "../packages/repository-intelligence/src/scanner.js";
import { ArchitectureGraphBuilder } from "../packages/architecture-graph/src/graph-builder.js";
import { GapEngine } from "../packages/saas-gap-analyzer/src/gap-engine.js";
import { ReportGenerator } from "../packages/saas-gap-analyzer/src/report-generator.js";

async function main() {
  const targetPath = process.argv[2];
  const outputDir = process.argv[3];

  if (!targetPath || !outputDir) {
    console.error("Usage: tsx scripts/run-scanner.ts <target-repo-path> <output-doc-dir>");
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`Scanning target repository: ${targetPath}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`======================================================\n`);

  try {
    const manifest = await RepositoryScanner.scan(targetPath);
    const graph = ArchitectureGraphBuilder.build(manifest);
    const gapReport = GapEngine.analyze(manifest, graph);
    const markdownReport = ReportGenerator.generateMarkdown(gapReport);

    await fs.mkdir(outputDir, { recursive: true });

    // 1. Write Manifest JSON & Markdown
    await fs.writeFile(
      path.join(outputDir, "REPOSITORY_MANIFEST.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );

    const manifestMd = [
      `# Repository Manifest — \`${manifest.repository.name}\``,
      ``,
      `**Path:** \`${manifest.repository.path}\`  `,
      `**Scanned At:** ${manifest.scannedAt}  `,
      ``,
      `## Stack Overview`,
      `- **Backend:** ${manifest.stack.backend} (${manifest.backend.framework})`,
      `- **Frontend:** ${manifest.stack.frontend} (${manifest.frontend.framework})`,
      `- **Database:** ${manifest.stack.database} (PostGIS: ${manifest.stack.postgis})`,
      `- **Background Jobs:** ${manifest.stack.queue} (${manifest.background_jobs.runner})`,
      `- **Storage:** ${manifest.stack.storage}`,
      `- **Admin:** ${manifest.admin.type} (${manifest.admin.resources.length} resources)`,
      ``,
      `## Domain Inventory`,
      `- **Routes Discovered:** ${manifest.backend.routes.length}`,
      `- **Models Discovered:** ${manifest.backend.models.length} (${manifest.backend.models.filter((m) => m.isTenantScoped).length} tenant-scoped)`,
      `- **Controllers Discovered:** ${manifest.backend.controllers.length}`,
      `- **Policies Discovered:** ${manifest.backend.policies.length}`,
      `- **Jobs Discovered:** ${manifest.backend.jobs.length}`,
      `- **Admin Resources:** ${manifest.backend.adminResources.map((r) => r.name).join(", ") || "None"}`,
      ``,
      `## Security Findings`,
      `- **Secret Findings:** ${manifest.security.secretFindings.length}`,
      `- **Blocked Unsafe Paths:** ${manifest.security.unsafeFilesBlocked.length}`,
      ``
    ].join("\n");

    await fs.writeFile(path.join(outputDir, "REPOSITORY_MANIFEST.md"), manifestMd, "utf-8");

    // 2. Write Architecture Graph JSON
    await fs.writeFile(
      path.join(outputDir, "ARCHITECTURE_GRAPH.json"),
      JSON.stringify(graph, null, 2),
      "utf-8"
    );

    // 3. Write Gap Report Markdown
    await fs.writeFile(path.join(outputDir, "GOLDEN_SAAS_GAP_REPORT.md"), markdownReport, "utf-8");

    console.log(`Scan completed successfully.`);
    console.log(`Overall Golden SaaS Alignment Score: ${gapReport.overallScore}/100`);
    console.log(`Summary: ${gapReport.summary.pass} PASS | ${gapReport.summary.partial} PARTIAL | ${gapReport.summary.missing} MISSING`);
    console.log(`Files generated in: ${outputDir}`);
  } catch (err) {
    console.error(`Failed to scan repository:`, err);
    process.exit(1);
  }
}

main();
