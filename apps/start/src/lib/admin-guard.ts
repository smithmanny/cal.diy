import { notFound } from "@tanstack/react-router";
import type { SessionUser } from "~/server/auth/session";

/** Admin pages don't exist for anyone else; server functions check the role again. */
export function requireAdmin(context: { user: SessionUser | null }): void {
  if (!context.user?.isAdmin) throw notFound();
}
