import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export class CreateFileMutation {
  public static execute(params: {
    absolutePath: string;
    content: string;
  }): { success: boolean; hash: string; bytesWritten: number; error?: string | undefined } {
    try {
      const dir = path.dirname(params.absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const buffer = Buffer.from(params.content, "utf-8");
      fs.writeFileSync(params.absolutePath, buffer);

      const hash = createHash("sha256").update(buffer).digest("hex");
      return { success: true, hash, bytesWritten: buffer.length };
    } catch (err: any) {
      return { success: false, hash: "", bytesWritten: 0, error: err.message };
    }
  }
}
