import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";
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
      userEmail: session.user.email,
      userTimeZone: session.user.timeZone ?? "Europe/London",
    },
  });
});

/** The signed-in user's id on public endpoints that treat hosts differently, else null. */
export const optionalUserId = createServerOnlyFn(async (): Promise<number | null> => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return session ? Number(session.user.id) : null;
});
