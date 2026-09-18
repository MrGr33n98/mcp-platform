import fs from "fs";
import { createHash } from "crypto";

export class ModifyFileMutation {
  public static execute(params: {
    absolutePath: string;
    newContent: string;
    expectedBeforeHash?: string | null | undefined;
  }): { success: boolean; hash: string; bytesWritten: number; error?: string | undefined } {
    try {
      if (!fs.existsSync(params.absolutePath)) {
        return { success: false, hash: "", bytesWritten: 0, error: `Target file for modification does not exist: ${params.absolutePath}` };
      }

      const currentBuffer = fs.readFileSync(params.absolutePath);
      const currentHash = createHash("sha256").update(currentBuffer).digest("hex");

      if (params.expectedBeforeHash && currentHash !== params.expectedBeforeHash) {
        return {
          success: false,
          hash: currentHash,
          bytesWritten: 0,
          error: `HASH_MISMATCH: Current file hash '${currentHash}' does not match expected_before_hash '${params.expectedBeforeHash}'. Lost update prevented.`
        };
      }

      const newBuffer = Buffer.from(params.newContent, "utf-8");
      fs.writeFileSync(params.absolutePath, newBuffer);

      const newHash = createHash("sha256").update(newBuffer).digest("hex");
      return { success: true, hash: newHash, bytesWritten: newBuffer.length };
    } catch (err: any) {
      return { success: false, hash: "", bytesWritten: 0, error: err.message };
    }
  }
}
