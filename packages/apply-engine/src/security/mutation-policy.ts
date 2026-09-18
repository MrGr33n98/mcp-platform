import type { MutationType } from "../types.js";

export class MutationPolicy {
  private static readonly ALLOWED_MUTATION_TYPES: MutationType[] = [
    "CREATE_FILE",
    "MODIFY_FILE",
    "PATCH_FILE"
  ];

  public static validateMutationType(type: MutationType): { allowed: boolean; reason?: string } {
    if (!this.ALLOWED_MUTATION_TYPES.includes(type)) {
      return {
        allowed: false,
        reason: `Mutation type '${type}' is strictly BLOCKED in Phase 5G baseline (only CREATE_FILE, MODIFY_FILE, and PATCH_FILE are authorized).`
      };
    }
    return { allowed: true };
  }

  public static validateNoArbitraryShell(command: string): { safe: boolean; reason?: string } {
    if (/;\s*rm\s+/i.test(command) || /\|\s*sh/i.test(command) || /`.*`/i.test(command) || /\$\(.*\)/i.test(command)) {
      return { safe: false, reason: "Arbitrary shell chaining/interpolation is blocked." };
    }
    return { safe: true };
  }
}
