import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessionUser } from "~/server/auth/session";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ location }) => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth/login", search: { callbackUrl: location.href } });
    return { user };
  },
  component: Outlet,
});
