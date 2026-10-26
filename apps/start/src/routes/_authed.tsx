import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { APP_SHELL_MESSAGE_KEYS, AppShell } from "~/components/AppShell";
import { loadMessages } from "~/lib/messages";

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: "/auth/login", search: { callbackUrl: location.href } });
    return { user: context.user };
  },
  loader: async ({ context }) => ({ messages: await loadMessages(context, APP_SHELL_MESSAGE_KEYS) }),
  component: AuthedLayout,
});
