import path from "path";
import fs from "fs";
import type { ChangeOperation, ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { ActualChangeSurface, MutationItem, MutationJournal, MutationManifest } from "../types.js";
import { PathPolicy } from "../security/path-policy.js";
import { FilePolicy } from "../security/file-policy.js";
import { MutationPolicy } from "../security/mutation-policy.js";
import { SecretPolicy } from "../security/secret-policy.js";
import { CreateFileMutation } from "./create-file.js";
import { ModifyFileMutation } from "./modify-file.js";
import { PatchFileMutation } from "./patch-file.js";
import { MutationJournalManager } from "../transactions/mutation-journal.js";

export class MutationEngine {
  public static buildManifest(params: {
    workspaceRoot: string;
    transactionId: string;
    changePlan: ChangePlan;
    verticalSlicePlan?: VerticalSlicePlan;
  }): { manifest: MutationManifest; targetRelativePaths: string[] } {
    const mutations: MutationItem[] = [];
    const targetRelativePaths: string[] = [];

    let createdCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;

    for (const op of params.changePlan.operations) {
      targetRelativePaths.push(op.path);

      let mutType: "CREATE_FILE" | "MODIFY_FILE" | "PATCH_FILE" = "CREATE_FILE";
      if (op.type === "CREATE_FILE" || op.type === "RUN_MIGRATION") {
        mutType = "CREATE_FILE";
        createdCount++;
      } else if (op.type === "MODIFY_FILE") {
        mutType = "MODIFY_FILE";
        modifiedCount++;
      }

      const absPath = path.resolve(params.workspaceRoot, op.path);
      mutations.push({
        operation_id: op.id,
        type: mutType,
        relative_path: op.path,
        absolute_path: absPath,
        expected_after_intent: op.description,
        content: op.codePreview || "",
        reason: op.description
      });
    }

    const manifest: MutationManifest = {
      manifest_version: 1,
      transaction_id: params.transactionId,
      created_at: new Date().toISOString(),
      mutations,
      total_files_created: createdCount,
      total_files_modified: modifiedCount,
      total_files_deleted: deletedCount
    };

    return { manifest, targetRelativePaths };
  }

  public static async executeMutations(params: {
    workspaceRoot: string;
    manifest: MutationManifest;
    journal: MutationJournal;
  }): Promise<{
    success: boolean;
    appliedItems: MutationItem[];
    createdFiles: string[];
    modifiedFiles: string[];
    actualSurface: ActualChangeSurface;
    error?: string;
  }> {
    const appliedItems: MutationItem[] = [];
    const createdFiles: string[] = [];
    const modifiedFiles: string[] = [];

    let linesAdded = 0;
    let linesRemoved = 0;
    let totalBytesWritten = 0;

    for (const mut of params.manifest.mutations) {
      // 1. Security Validations
      const pathVal = PathPolicy.validatePath(params.workspaceRoot, mut.relative_path);
      if (!pathVal.valid) {
        const err = `Path security rejection: ${pathVal.reason}`;
        MutationJournalManager.appendEntry(params.workspaceRoot, params.journal, {
          operation_id: mut.operation_id,
          mutation_type: mut.type,
          path: mut.relative_path,
          before_hash: null,
          after_hash: null,
          status: "FAILED",
          error: err
        });
        return { success: false, appliedItems, createdFiles, modifiedFiles, actualSurface: { files_created: createdFiles, files_modified: modifiedFiles, files_deleted: [], lines_added: linesAdded, lines_removed: linesRemoved, total_bytes_written: totalBytesWritten }, error: err };
      }

      const fileVal = FilePolicy.isProtectedFile(mut.relative_path);
      if (fileVal.protected) {
        const err = `Protected file policy rejection: ${fileVal.reason}`;
        MutationJournalManager.appendEntry(params.workspaceRoot, params.journal, {
          operation_id: mut.operation_id,
          mutation_type: mut.type,
          path: mut.relative_path,
          before_hash: null,
          after_hash: null,
          status: "FAILED",
          error: err
        });
        return { success: false, appliedItems, createdFiles, modifiedFiles, actualSurface: { files_created: createdFiles, files_modified: modifiedFiles, files_deleted: [], lines_added: linesAdded, lines_removed: linesRemoved, total_bytes_written: totalBytesWritten }, error: err };
      }

      const mutTypeVal = MutationPolicy.validateMutationType(mut.type);
      if (!mutTypeVal.allowed) {
        const err = `Mutation policy rejection: ${mutTypeVal.reason}`;
        MutationJournalManager.appendEntry(params.workspaceRoot, params.journal, {
          operation_id: mut.operation_id,
          mutation_type: mut.type,
          path: mut.relative_path,
          before_hash: null,
          after_hash: null,
          status: "FAILED",
          error: err
        });
        return { success: false, appliedItems, createdFiles, modifiedFiles, actualSurface: { files_created: createdFiles, files_modified: modifiedFiles, files_deleted: [], lines_added: linesAdded, lines_removed: linesRemoved, total_bytes_written: totalBytesWritten }, error: err };
      }

      if (mut.content) {
        const secretVal = SecretPolicy.containsRawLiveSecret(mut.content);
        if (secretVal.hasSecret) {
          const err = `Secret policy rejection: ${secretVal.reason}`;
          MutationJournalManager.appendEntry(params.workspaceRoot, params.journal, {
            operation_id: mut.operation_id,
            mutation_type: mut.type,
            path: mut.relative_path,
            before_hash: null,
            after_hash: null,
            status: "FAILED",
            error: err
          });
          return { success: false, appliedItems, createdFiles, modifiedFiles, actualSurface: { files_created: createdFiles, files_modified: modifiedFiles, files_deleted: [], lines_added: linesAdded, lines_removed: linesRemoved, total_bytes_written: totalBytesWritten }, error: err };
        }
      }

      // 2. Compute Before Hash if file exists
      let beforeHash: string | null = null;
      if (fs.existsSync(mut.absolute_path)) {
        beforeHash = ModifyFileMutation.execute({
          absolutePath: mut.absolute_path,
          newContent: fs.readFileSync(mut.absolute_path, "utf-8")
        }).hash;
      }

      // 3. Execute Mutation
      let result: { success: boolean; hash: string; bytesWritten: number; error?: string | undefined };

      if (mut.type === "CREATE_FILE") {
        result = CreateFileMutation.execute({
          absolutePath: mut.absolute_path,
          content: mut.content || ""
        });
        if (result.success) {
          createdFiles.push(mut.relative_path);
          linesAdded += (mut.content || "").split("\n").length;
        }
      } else if (mut.type === "MODIFY_FILE") {
        result = ModifyFileMutation.execute({
          absolutePath: mut.absolute_path,
          newContent: mut.content || "",
          expectedBeforeHash: mut.expected_before_hash
        });
        if (result.success) {
          modifiedFiles.push(mut.relative_path);
          linesAdded += (mut.content || "").split("\n").length;
        }
      } else if (mut.type === "PATCH_FILE") {
        result = PatchFileMutation.execute({
          absolutePath: mut.absolute_path,
          replacementContent: mut.content || "",
          expectedBeforeHash: mut.expected_before_hash
        });
        if (result.success) {
          modifiedFiles.push(mut.relative_path);
          linesAdded += (mut.content || "").split("\n").length;
        }
      } else {
        result = { success: false, hash: "", bytesWritten: 0, error: `Unsupported mutation type: ${mut.type}` };
      }

      if (!result.success) {
        MutationJournalManager.appendEntry(params.workspaceRoot, params.journal, {
          operation_id: mut.operation_id,
          mutation_type: mut.type,
          path: mut.relative_path,
          before_hash: beforeHash,
          after_hash: null,
          status: "FAILED",
          error: result.error
        });

        return {
          success: false,
          appliedItems,
          createdFiles,
          modifiedFiles,
          actualSurface: {
            files_created: createdFiles,
            files_modified: modifiedFiles,
            files_deleted: [],
            lines_added: linesAdded,
            lines_removed: linesRemoved,
            total_bytes_written: totalBytesWritten
          },
          error: `Failed mutation on '${mut.relative_path}': ${result.error}`
        };
      }

      totalBytesWritten += result.bytesWritten;
      appliedItems.push(mut);

      MutationJournalManager.appendEntry(params.workspaceRoot, params.journal, {
        operation_id: mut.operation_id,
        mutation_type: mut.type,
        path: mut.relative_path,
        before_hash: beforeHash,
        after_hash: result.hash,
        status: "APPLIED"
      });
    }

    return {
      success: true,
      appliedItems,
      createdFiles,
      modifiedFiles,
      actualSurface: {
        files_created: createdFiles,
        files_modified: modifiedFiles,
        files_deleted: [],
        lines_added: linesAdded,
        lines_removed: linesRemoved,
        total_bytes_written: totalBytesWritten
      }
    };
  }
}
