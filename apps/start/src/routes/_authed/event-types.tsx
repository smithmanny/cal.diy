import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { createT } from "~/lib/i18n";
import { getMessages } from "~/server/i18n";

const MESSAGE_KEYS = ["event_types_page_title", "signed_in_as", "sign_out"];

function EventTypesPage() {
  const { user } = Route.useRouteContext();
  const messages = Route.useLoaderData();
  const navigate = useNavigate();
  const t = createT(messages);

  async function signOut() {
    await authClient.signOut();
    await navigate({ to: "/auth/login", search: { callbackUrl: "/event-types" } });
  }

  return (
    <main>
      <h1>{t("event_types_page_title")}</h1>
      <p>{t("signed_in_as", { name: user.name ?? user.username ?? user.email })}</p>
      <button type="button" onClick={signOut}>
        {t("sign_out")}
      </button>
    </main>
  );
}

export const Route = createFileRoute("/_authed/event-types")({
  loader: () => getMessages({ data: MESSAGE_KEYS }),
  component: EventTypesPage,
});
