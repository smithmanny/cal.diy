import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { Textarea } from "@coss/ui/components/textarea";
import { type FormEvent, useState } from "react";
import { errorMessageKey } from "~/lib/errors";
import type { TFunction } from "~/lib/i18n";
import { pingWebhook } from "~/server/webhooks/functions";
import { SUPPORTED_TRIGGERS, type SupportedTrigger, type WebhookInput } from "~/server/webhooks/types";
import { FormError } from "../AuthCard";

const TRIGGER_LABEL_KEYS: Record<SupportedTrigger, string> = {
  BOOKING_CREATED: "booking_created",
  BOOKING_REQUESTED: "booking_requested",
  BOOKING_RESCHEDULED: "booking_rescheduled",
  BOOKING_CANCELLED: "booking_cancelled",
  BOOKING_REJECTED: "booking_rejected",
};

export const WEBHOOK_FORM_MESSAGE_KEYS = [
  ...Object.values(TRIGGER_LABEL_KEYS),
  "subscriber_url",
  "event_triggers",
  "enable_webhook",
  "secret",
  "change_secret",
  "webhook_secret_key_description",
  "payload_template",
  "ping_test",
  "test_passed",
  "test_failed",
  "save",
  "cancel",
  "webhook_subscriber_url_reserved",
  "not_found",
  "something_went_wrong",
];

export function WebhookForm({
  initial,
  hasSecret,
  onSubmit,
  onCancel,
  t,
}: {
  initial: Omit<WebhookInput, "secret">;
  hasSecret: boolean;
  onSubmit: (input: WebhookInput) => Promise<void>;
  onCancel: () => void;
  t: TFunction;
}) {
  const [subscriberUrl, setSubscriberUrl] = useState(initial.subscriberUrl);
  const [triggers, setTriggers] = useState<SupportedTrigger[]>(initial.eventTriggers);
  const [active, setActive] = useState(initial.active);
  const [editingSecret, setEditingSecret] = useState(!hasSecret);
  const [secret, setSecret] = useState("");
  const [template, setTemplate] = useState(initial.payloadTemplate ?? "");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [ping, setPing] = useState<{ ok: boolean; status: number } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorKey(null);
    try {
      await onSubmit({
        subscriberUrl,
        eventTriggers: triggers,
        active,
        secret: editingSecret ? secret : undefined,
        payloadTemplate: template || null,
      });
    } catch (error) {
      setErrorKey(errorMessageKey(error));
      setPending(false);
    }
  }

  async function runPing() {
    setPing(null);
    setPing(await pingWebhook({ data: { subscriberUrl, secret: editingSecret ? secret : undefined } }));
  }

  const toggleTrigger = (trigger: SupportedTrigger, on: boolean) =>
    setTriggers((current) => (on ? [...current, trigger] : current.filter((t) => t !== trigger)));

  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border p-4">
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("subscriber_url")}
        <div className="flex gap-2">
          <Input
            type="url"
            required
            value={subscriberUrl}
            onChange={(e) => setSubscriberUrl(e.target.value)}
            placeholder="https://"
          />
          <Button type="button" variant="outline" disabled={!subscriberUrl} onClick={runPing}>
            {t("ping_test")}
          </Button>
        </div>
        {ping && (
          <span role="status" className={ping.ok ? "text-success-foreground" : "text-destructive-foreground"}>
            {ping.ok ? t("test_passed") : `${t("test_failed")} (${ping.status || "-"})`}
          </span>
        )}
      </label>
      <label className="flex items-center gap-2 font-medium text-sm">
        <Switch checked={active} onCheckedChange={setActive} />
        {t("enable_webhook")}
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium text-sm">{t("event_triggers")}</legend>
        {SUPPORTED_TRIGGERS.map((trigger) => (
          <label key={trigger} className="flex items-center gap-2 text-sm">
            <Switch
              checked={triggers.includes(trigger)}
              onCheckedChange={(on) => toggleTrigger(trigger, on)}
            />
            {t(TRIGGER_LABEL_KEYS[trigger])}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("secret")}</span>
        {editingSecret ? (
          <Input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setEditingSecret(true)}>
            {t("change_secret")}
          </Button>
        )}
        <span className="text-muted-foreground text-xs">
          {t("webhook_secret_key_description", { appName: "Cal.diy" })}
        </span>
      </div>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("payload_template")}
        <Textarea
          rows={5}
          className="font-mono"
          placeholder='{"title": "{{title}}", "start": "{{startTime}}"}'
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
      </label>
      <FormError message={errorKey && t(errorKey)} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || triggers.length === 0}>
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
