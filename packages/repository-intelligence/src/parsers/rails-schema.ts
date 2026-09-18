import fs from "node:fs/promises";
import path from "node:path";
import type { TableDefinition } from "../types.js";

export class RailsSchemaParser {
  public static async parse(repoRoot: string): Promise<TableDefinition[]> {
    const tables: TableDefinition[] = [];
    const schemaPaths = [
      path.join(repoRoot, "db", "schema.rb"),
      path.join(repoRoot, "backend", "db", "schema.rb")
    ];

    let content = "";
    let matchedFile = "";
    for (const p of schemaPaths) {
      try {
        content = await fs.readFile(p, "utf-8");
        matchedFile = p;
        break;
      } catch {
        //
      }
    }

    if (!content) return tables;

    const lines = content.split("\n");
    let currentTable: TableDefinition | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";
      const tableMatch = line.match(/create_table\s+["']([^"']+)["']/);
      if (tableMatch && tableMatch[1]) {
        if (currentTable) tables.push(currentTable);
        currentTable = {
          name: tableMatch[1],
          columns: [],
          indexes: [],
          evidence: {
            file: matchedFile,
            line_start: i + 1,
            symbol: tableMatch[1],
            evidence_type: "DATABASE_CONSTRAINT",
            detector: "RailsSchemaParser",
            confidence: "HIGH",
            description: `Database table ${tableMatch[1]} declared in schema.rb.`
          }
        };
        continue;
      }

      if (currentTable) {
        if (line === "end") {
          tables.push(currentTable);
          currentTable = null;
          continue;
        }

        const colMatch = line.match(/t\.(\w+)\s+["']([^"']+)["'](?:,\s*(.*))?/);
        if (colMatch && colMatch[1] && colMatch[2]) {
          const colType = colMatch[1];
          const colName = colMatch[2];
          const colOpts = colMatch[3] || "";
          
          currentTable.columns.push({
            name: colName,
            type: colType,
            nullable: !colOpts.includes("null: false")
          });
          continue;
        }

        const indexMatch = line.match(/t\.index\s+\[?([^\]]+)\]?(?:,\s*name:\s*["']([^"']+)["'])?/);
        if (indexMatch && indexMatch[1]) {
          currentTable.indexes.push(indexMatch[1].replace(/["'\s]/g, ""));
        }
      }
    }

    return tables;
  }
}
