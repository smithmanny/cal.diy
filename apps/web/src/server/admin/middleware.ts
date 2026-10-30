import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "../auth/auth";
import { IS_PRODUCTION_BUILD } from "../build";
import { AppError } from "../errors";

/** Admin-only server functions; Better Auth's admin endpoints check the role again on every change. */
export const adminMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new AppError("unauthorized", 401);
  if (session.user.role !== "ADMIN") throw new AppError("unauthorized", 403);
  // Cal treats an admin without two-factor authentication as inactive in production.
  if (IS_PRODUCTION_BUILD && !session.user.twoFactorEnabled)
    throw new AppError("admin_needs_two_factor", 403);
  return next({ context: { adminId: Number(session.user.id) } });
});
