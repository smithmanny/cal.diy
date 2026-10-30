// Better Auth's built-in codes mapped onto existing translation keys. Codes raised by our own
// hooks (see server/auth/createAuth.ts) are already translation keys and pass through.
const BETTER_AUTH_CODE_TO_KEY: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "incorrect_email_password",
  USER_ALREADY_EXISTS: "email_already_used",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "email_already_used",
  PASSWORD_TOO_SHORT: "invalid_password_hint",
  INVALID_PASSWORD: "incorrect_password",
  INVALID_TOKEN: "invalid_link",
  INVALID_CODE: "incorrect_2fa_code",
  INVALID_BACKUP_CODE: "incorrect_2fa_code",
  INVALID_TWO_FACTOR_COOKIE: "session_timeout",
  ACCOUNT_TEMPORARILY_LOCKED: "too_many_attempts",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "too_many_attempts",
  BANNED_USER: "your_account_is_locked",
};

export const MIN_PASSWORD_LENGTH = 7;

/** Values the auth error messages interpolate, e.g. the length in `invalid_password_hint`. */
export const AUTH_ERROR_VALUES = { passwordLength: MIN_PASSWORD_LENGTH };

export const AUTH_ERROR_MESSAGE_KEYS = [
  ...new Set(Object.values(BETTER_AUTH_CODE_TO_KEY)),
  "too_many_attempts",
  "invalid_password_hint",
  "username_already_taken",
  "something_went_wrong",
];

export function authErrorKey(
  error: { code?: string; message?: string; status?: number } | null | undefined
): string {
  if (!error) return "something_went_wrong";
  // Better Auth's rate limiter answers with a bare 429 and no error code.
  if (error.status === 429) return "too_many_attempts";
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
