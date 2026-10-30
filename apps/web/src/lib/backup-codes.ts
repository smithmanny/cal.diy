const UNDASHED_BACKUP_CODE = /^[A-Za-z0-9]{10}$/;

/**
 * Backup codes are stored as "abcde-12345". Cal accepted them without the dash too, so people who
 * kept their codes from before the move may type them that way.
 */
export function normalizeBackupCode(input: string): string {
  const code = input.trim();
  return UNDASHED_BACKUP_CODE.test(code) ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}
