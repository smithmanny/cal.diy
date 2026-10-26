import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "~/components/AppShell";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";

function EventTypesPage() {
  const t = useT();
  return <PageHeader title={t("event_types_page_title")} />;
}

export const Route = createFileRoute("/_authed/event-types")({
  loader: async ({ context }) => ({ messages: await loadMessages(context, ["event_types_page_title"]) }),
  component: EventTypesPage,
});
