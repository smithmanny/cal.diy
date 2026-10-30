import { createFileRoute, redirect } from "@tanstack/react-router";

/** Cal's separate "new webhook" page; webhooks are created from the list here. */
export const Route = createFileRoute("/_authed/settings/developer/webhooks/new")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/developer/webhooks" });
  },
});
