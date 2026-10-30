import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { WEBHOOK_FORM_MESSAGE_KEYS, WebhookForm } from "~/components/webhooks/WebhookForm";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { createWebhook, deleteWebhook, listWebhooks } from "~/server/webhooks/functions";

const MESSAGE_KEYS = [
  ...WEBHOOK_FORM_MESSAGE_KEYS,
  "webhooks",
  "new_webhook",
  "create_your_first_webhook",
  "create_your_first_webhook_description",
  "enabled",
  "disabled",
  "edit",
  "delete",
  "delete_webhook",
];

function WebhooksPage() {
  const { webhooks } = Route.useLoaderData();
  const t = useT();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function remove(id: string) {
    if (!window.confirm(t("delete_webhook"))) return;
    try {
      await deleteWebhook({ data: { id } });
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <HydratedFieldset>
      <PageHeader
        title={t("webhooks")}
        description={t("create_your_first_webhook_description", { appName: "Cal.diy" })}
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            {t("new_webhook")}
          </Button>
        }
      />
      {creating && (
        <div className="mb-6">
          <WebhookForm
            initial={{
              subscriberUrl: "",
              eventTriggers: ["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"],
              active: true,
              payloadTemplate: null,
            }}
            hasSecret={false}
            t={t}
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              await createWebhook({ data: input });
              setCreating(false);
              await router.invalidate();
            }}
          />
        </div>
      )}
      <FormError message={errorKey && t(errorKey)} />
      {webhooks.length === 0 && !creating ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t("create_your_first_webhook")}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {webhooks.map((webhook) => (
            <li key={webhook.id} className="flex items-center gap-3 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium text-sm">{webhook.subscriberUrl}</span>
                <span className="flex flex-wrap gap-1">
                  <Badge variant={webhook.active ? "success" : "outline"}>
                    {webhook.active ? t("enabled") : t("disabled")}
                  </Badge>
                  {webhook.eventTriggers.map((trigger) => (
                    <Badge key={trigger} variant="secondary">
                      {trigger}
                    </Badge>
                  ))}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link to="/settings/developer/webhooks/$webhookId" params={{ webhookId: webhook.id }} />
                }>
                {t("edit")}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("delete")}
                onClick={() => remove(webhook.id)}>
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/developer/webhooks/")({
  loader: async ({ context }) => {
    const [messages, webhooks] = await Promise.all([loadMessages(context, MESSAGE_KEYS), listWebhooks()]);
    return { messages, webhooks };
  },
  component: WebhooksPage,
});
