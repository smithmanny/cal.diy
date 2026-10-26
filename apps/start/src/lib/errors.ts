/** Server functions throw translation keys as messages (see server/errors.ts). */
export function errorMessageKey(error: unknown): string {
  if (error instanceof Error && /^[a-z0-9_]+$/.test(error.message)) return error.message;
  return "something_went_wrong";
}
