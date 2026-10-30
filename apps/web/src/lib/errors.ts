const APP_ERROR_MESSAGE = /^([a-z0-9_]+)(?::(\{.*\}))?$/s;

/** Server functions throw translation keys as messages (see server/errors.ts). */
export function errorMessageKey(error: unknown): string {
  const match = error instanceof Error ? APP_ERROR_MESSAGE.exec(error.message) : null;
  return match?.[1] ?? "something_went_wrong";
}

/** The values an AppError sent for its translation, e.g. { count: 2 }. */
export function errorMessageValues(error: unknown): Record<string, string | number> | undefined {
  const json = error instanceof Error ? APP_ERROR_MESSAGE.exec(error.message)?.[2] : undefined;
  if (!json) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string | number>) : undefined;
  } catch {
    return undefined;
  }
}
