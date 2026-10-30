import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Cal's reset links (/auth/forgot-password/<id>). Their tokens were Cal's own and can't be used
 * here, so the link starts a new reset instead of failing.
 */
export const Route = createFileRoute("/auth/forgot-password_/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/forgot-password", statusCode: 302 });
  },
});
