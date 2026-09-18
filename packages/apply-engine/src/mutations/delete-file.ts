export class DeleteFileMutation {
  public static execute(params: {
    absolutePath: string;
  }): { success: boolean; error?: string } {
    return {
      success: false,
      error: `DELETE_FILE is strictly BLOCKED in Phase 5G baseline for path: ${params.absolutePath}`
    };
  }
}
