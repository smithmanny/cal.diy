import slugify from "@calcom/lib/slugify";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { Textarea } from "@coss/ui/components/textarea";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { Field, Section } from "~/components/event-types/EditorLayout";
import { LIMITS_MESSAGE_KEYS, LimitsEditor, limitsErrorKey } from "~/components/event-types/LimitsEditor";
import { LOCATIONS_MESSAGE_KEYS, LocationsEditor } from "~/components/event-types/LocationsEditor";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { deleteEventType, getEventType, updateEventType } from "~/server/event-types/functions";
import type { EventTypeInput } from "~/server/event-types/types";
import { listSchedules } from "~/server/schedules/functions";

const MESSAGE_KEYS = [
  ...LOCATIONS_MESSAGE_KEYS,
  ...LIMITS_MESSAGE_KEYS,
  "setup",
  "availability",
  "event_limit_tab_title",
  "advanced",
  "title",
  "url",
  "description",
  "duration",
  "minutes",
  "default",
  "requires_confirmation",
  "hide_from_profile",
  "save",
  "saved",
  "preview",
  "back",
  "delete",
  "delete_event_type",
  "delete_event_type_description",
  "url_taken",
  "not_found",
  "something_went_wrong",
];

function EventTypeEditorPage() {
  const { eventType, schedules } = Route.useLoaderData();
  const { user, origin } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const navigate = useNavigate();
  const { id, ...initial } = eventType;
  const [form, setForm] = useState<EventTypeInput>(initial);
  const [status, setStatus] = useState<{ kind: "error" | "saved"; key: string } | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof EventTypeInput>(key: K, value: EventTypeInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const bookingUrl = `${origin}/${user.username}/${eventType.slug}`;

  async function save() {
    const invalid = limitsErrorKey(form);
    if (invalid) {
      setStatus({ kind: "error", key: invalid });
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await updateEventType({ data: { id, eventType: form } });
      await router.invalidate();
      setStatus({ kind: "saved", key: "saved" });
    } catch (error) {
      setStatus({ kind: "error", key: errorMessageKey(error) });
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!window.confirm(`${t("delete_event_type")}\n\n${t("delete_event_type_description")}`)) return;
    try {
      await deleteEventType({ data: { id } });
      await navigate({ to: "/event-types" });
    } catch (error) {
      setStatus({ kind: "error", key: errorMessageKey(error) });
    }
  }

  return (
    <HydratedFieldset className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label={t("back")} render={<Link to="/event-types" />}>
            <ArrowLeftIcon />
          </Button>
          <h1 className="truncate font-heading text-2xl">{eventType.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<a href={bookingUrl} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon />
            {t("preview")}
          </Button>
          <Button disabled={pending} onClick={save}>
            {t("save")}
          </Button>
        </div>
      </div>
      {status &&
        (status.kind === "error" ? (
          <FormError message={t(status.key)} />
        ) : (
          <p role="status" className="text-sm text-success-foreground">
            {t(status.key)}
          </p>
        ))}

      <Section title={t("setup")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("title")}>
            <Input value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label={t("url")}>
            <div className="flex items-center gap-1">
              <span className="truncate text-muted-foreground text-xs">/{user.username}/</span>
              <Input value={form.slug} onChange={(e) => set("slug", slugify(e.target.value, true))} />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("description")}>
              <Textarea
                rows={3}
                maxLength={5000}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value || null)}
              />
            </Field>
          </div>
          <Field label={`${t("duration")} (${t("minutes")})`}>
            <Input
              type="number"
              min={1}
              max={1440}
              value={form.length}
              onChange={(e) => set("length", Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label={t("location")}>
          <LocationsEditor
            value={form.locations}
            onChange={(locations) => set("locations", locations)}
            t={t}
          />
        </Field>
      </Section>

      <Section title={t("availability")}>
        <select
          aria-label={t("availability")}
          className={`${selectClass} max-w-sm`}
          value={form.scheduleId ?? ""}
          onChange={(e) => set("scheduleId", e.target.value ? Number(e.target.value) : null)}>
          <option value="">
            {t("default")} ({schedules.find((s) => s.isDefault)?.name ?? "-"})
          </option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>
              {schedule.name}
            </option>
          ))}
        </select>
      </Section>

      <Section title={t("event_limit_tab_title")}>
        <LimitsEditor form={form} set={set} t={t} />
      </Section>

      <Section title={t("advanced")}>
        <label className="flex items-center gap-2 font-medium text-sm">
          <Switch
            checked={form.requiresConfirmation}
            onCheckedChange={(v) => set("requiresConfirmation", v)}
          />
          {t("requires_confirmation")}
        </label>
        <label className="flex items-center gap-2 font-medium text-sm">
          <Switch checked={form.hidden} onCheckedChange={(v) => set("hidden", v)} />
          {t("hide_from_profile")}
        </label>
      </Section>

      <div>
        <Button variant="destructive-outline" onClick={remove}>
          {t("delete")}
        </Button>
      </div>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/event-types/$eventTypeId")({
  params: {
    parse: ({ eventTypeId }) => {
      const id = Number(eventTypeId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { eventTypeId: id };
    },
    stringify: ({ eventTypeId }) => ({ eventTypeId: String(eventTypeId) }),
  },
  loader: async ({ context, params }) => {
    const [messages, eventType, schedules] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getEventType({ data: { id: params.eventTypeId } }),
      listSchedules(),
    ]);
    return { messages, eventType, schedules };
  },
  component: EventTypeEditorPage,
});
