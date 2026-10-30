export type AppErrorValues = Record<string, string | number>;

/**
 * Expected, user-facing failures. `code` is a translation key the client renders with `t()`, so it
 * is also the message (TanStack Start forwards the message to the client). Values for the
 * translation travel after it as `code:{json}`; see errorMessageValues in lib/errors.ts.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 = 400,
    readonly values?: AppErrorValues
  ) {
    super(values ? `${code}:${JSON.stringify(values)}` : code);
    this.name = "AppError";
  }
}
