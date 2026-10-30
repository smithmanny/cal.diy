import { createMiddleware } from "@tanstack/react-start";
import { AppError } from "./errors";

function isRedirectOrNotFound(error: unknown): boolean {
  return (
    error instanceof Response ||
    (typeof error === "object" && error !== null && ("isNotFound" in error || "isRedirect" in error))
  );
}

/**
 * TanStack Start forwards a thrown error's message to the browser. Expected failures are
 * AppErrors carrying a translation key; anything else (DB errors, bugs) is logged and replaced
 * so internals like SQL never reach the client.
 */
export const errorMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof AppError || isRedirectOrNotFound(error)) throw error;
    console.error("Unhandled server function error", error);
    throw new AppError("something_went_wrong", 400);
  }
});
