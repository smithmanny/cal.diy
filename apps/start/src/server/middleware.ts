import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth/auth";
import { AppError } from "./errors";

/** Server-function middleware that resolves the signed-in user or rejects the call. */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new AppError("unauthorized", 401);
  return next({
    context: {
      userId: Number(session.user.id),
      userTimeZone: session.user.timeZone ?? "Europe/London",
    },
  });
});
