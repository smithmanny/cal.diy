import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "~/components/AppShell";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { WEBHOOK_FORM_MESSAGE_KEYS, WebhookForm } from "~/components/webhooks/WebhookForm";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getWebhook, updateWebhook } from "~/server/webhooks/functions";

function EditWebhookPage() {
  const { webhook } = Route.useLoaderData();
  const t = useT();
  const navigate = useNavigate();
  const back = () => navigate({ to: "/settings/developer/webhooks" });
  return (
    <HydratedFieldset>
      <PageHeader title={t("edit_webhook")} />
      <WebhookForm
        initial={webhook}
        hasSecret={webhook.hasSecret}
        t={t}
        onCancel={back}
        onSubmit={async (input) => {
          await updateWebhook({ data: { id: webhook.id, webhook: input } });
          await back();
        }}
      />
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/developer/webhooks/$webhookId")({
  loader: async ({ context, params }) => {
    const [messages, webhook] = await Promise.all([
      loadMessages(context, [...WEBHOOK_FORM_MESSAGE_KEYS, "edit_webhook"]),
      getWebhook({ data: { id: params.webhookId } }),
    ]);
    return { messages, webhook };
  },
  component: EditWebhookPage,
});
