// Better Auth's built-in codes mapped onto existing translation keys. Codes raised by our own
// hooks (see server/auth/createAuth.ts) are already translation keys and pass through.
const BETTER_AUTH_CODE_TO_KEY: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "incorrect_email_password",
  USER_ALREADY_EXISTS: "email_already_used",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "email_already_used",
  PASSWORD_TOO_SHORT: "invalid_password_hint",
};

export const AUTH_ERROR_MESSAGE_KEYS = [
  ...new Set(Object.values(BETTER_AUTH_CODE_TO_KEY)),
  "invalid_password_hint",
  "username_already_taken",
  "something_went_wrong",
];

export function authErrorKey(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "something_went_wrong";
  if (error.code && BETTER_AUTH_CODE_TO_KEY[error.code]) return BETTER_AUTH_CODE_TO_KEY[error.code];
  if (error.code && AUTH_ERROR_MESSAGE_KEYS.includes(error.code.toLowerCase()))
    return error.code.toLowerCase();
  if (error.message && AUTH_ERROR_MESSAGE_KEYS.includes(error.message)) return error.message;
  return "something_went_wrong";
}

/** Only same-origin paths, so a crafted `callbackUrl` can't bounce users to another site. */
export function safeCallbackUrl(value: unknown, fallback = "/event-types"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return fallback;
  }
  return value;
}
