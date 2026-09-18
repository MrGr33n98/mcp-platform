export interface RemoteValidationResult {
  valid: boolean;
  errors: string[];
}

export class RemoteValidator {
  public static validate(remoteName: string): RemoteValidationResult {
    const errors: string[] = [];

    if (!remoteName || !remoteName.trim()) {
      errors.push("Remote name cannot be empty.");
      return { valid: false, errors };
    }

    const trimmed = remoteName.trim();
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(trimmed)) {
      errors.push(`Invalid remote name format: '${remoteName}'`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
