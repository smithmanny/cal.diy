/**
 * Expected, user-facing failures. `code` is a translation key the client renders with `t()`,
 * so it is also used as the message (TanStack Start forwards the message to the client).
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 | 403 | 404 | 409 = 400
  ) {
    super(code);
    this.name = "AppError";
  }
}
