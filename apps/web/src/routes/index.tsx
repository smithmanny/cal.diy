import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    throw redirect(
      context.user ? { to: "/event-types" } : { to: "/auth/login", search: { callbackUrl: "/event-types" } }
    );
  },
});
