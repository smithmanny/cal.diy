import { Button } from "@coss/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { currentSubscription, isPushSupported, subscribeBrowser } from "~/lib/push-client";
import { getPushConfig, subscribeToPush, unsubscribeFromPush } from "~/server/push/functions";

const MESSAGE_KEYS = [
  "push_notifications",
  "push_notifications_new_bookings_description",
  "push_notifications_not_configured",
  "allow_browser_notifications",
  "disable_browser_notifications",
  "browser_notifications_turned_on",
  "browser_notifications_turned_off",
  "browser_notifications_denied",
  "browser_notifications_not_supported",
  "something_went_wrong",
];

type State = "loading" | "unsupported" | "off" | "on";

function usePushState() {
  const [state, setState] = useState<State>("loading");
  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    currentSubscription()
      .then((subscription) => setState(subscription ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);
  return [state, setState] as const;
}

function PushNotificationsPage() {
  const { publicKey } = Route.useLoaderData();
  const t = useT();
  const [state, setState] = usePushState();
  const [message, setMessage] = useState<{ kind: "error" | "status"; key: string } | null>(null);

  async function run(action: () => Promise<string>) {
    setMessage(null);
    try {
      setMessage({ kind: "status", key: await action() });
    } catch (error) {
      setMessage({ kind: "error", key: errorMessageKey(error) });
    }
  }

  const enable = (key: string) =>
    run(async () => {
      const subscription = await subscribeBrowser(key);
      if (!subscription?.endpoint || !subscription.keys) return "browser_notifications_denied";
      const { p256dh, auth } = subscription.keys;
      await subscribeToPush({ data: { endpoint: subscription.endpoint, keys: { p256dh, auth } } });
      setState("on");
      return "browser_notifications_turned_on";
    });
  const disable = () =>
    run(async () => {
      const subscription = await currentSubscription();
      if (subscription) {
        await unsubscribeFromPush({ data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setState("off");
      return "browser_notifications_turned_off";
    });

  return (
    <HydratedFieldset>
      <div className="flex max-w-lg flex-col gap-4">
        <div>
          <h2 className="font-medium">{t("push_notifications")}</h2>
          <p className="text-muted-foreground text-sm">{t("push_notifications_new_bookings_description")}</p>
        </div>
        {!publicKey && (
          <p className="text-muted-foreground text-sm">{t("push_notifications_not_configured")}</p>
        )}
        {publicKey && state === "unsupported" && (
          <p className="text-muted-foreground text-sm">{t("browser_notifications_not_supported")}</p>
        )}
        {publicKey && state === "off" && (
          <Button className="self-start" onClick={() => enable(publicKey)}>
            {t("allow_browser_notifications")}
          </Button>
        )}
        {publicKey && state === "on" && (
          <Button className="self-start" variant="outline" onClick={disable}>
            {t("disable_browser_notifications")}
          </Button>
        )}
        {message?.kind === "error" && <FormError message={t(message.key)} />}
        {message?.kind === "status" && (
          <p role="status" className="text-sm">
            {t(message.key)}
          </p>
        )}
      </div>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/my-account/push-notifications")({
  loader: async ({ context }) => {
    const [messages, config] = await Promise.all([loadMessages(context, MESSAGE_KEYS), getPushConfig()]);
    return { messages, publicKey: config.publicKey };
  },
  component: PushNotificationsPage,
});
