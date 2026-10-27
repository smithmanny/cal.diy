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
import { BOOKER_LAYOUT_MESSAGE_KEYS, BookerLayoutSettings } from "~/components/BookerLayoutSettings";
import {
  ADVANCED_MESSAGE_KEYS,
  AdvancedEditor,
  seatsErrorKey,
} from "~/components/event-types/AdvancedEditor";
import {
  BOOKING_QUESTIONS_MESSAGE_KEYS,
  BookingQuestionsEditor,
} from "~/components/event-types/BookingQuestionsEditor";
import { DURATION_MESSAGE_KEYS, DurationEditor } from "~/components/event-types/DurationEditor";
import { Field, Section } from "~/components/event-types/EditorLayout";
import { LIMITS_MESSAGE_KEYS, LimitsEditor, limitsErrorKey } from "~/components/event-types/LimitsEditor";
import { LOCATIONS_MESSAGE_KEYS, LocationsEditor } from "~/components/event-types/LocationsEditor";
import { PRIVATE_LINKS_MESSAGE_KEYS, PrivateLinksEditor } from "~/components/event-types/PrivateLinksEditor";
import { RECURRING_EDITOR_MESSAGE_KEYS, RecurringEditor } from "~/components/event-types/RecurringEditor";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { DEFAULT_BOOKER_LAYOUTS } from "~/lib/booker-layouts";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { deleteEventType, getEventType, updateEventType } from "~/server/event-types/functions";
import type { EventTypeInput } from "~/server/event-types/types";
import { listSchedules } from "~/server/schedules/functions";

const MESSAGE_KEYS = [
  ...BOOKER_LAYOUT_MESSAGE_KEYS,
  "layout",
  "bookerlayout_override",
  ...ADVANCED_MESSAGE_KEYS,
  ...PRIVATE_LINKS_MESSAGE_KEYS,
  ...RECURRING_EDITOR_MESSAGE_KEYS,
  "recurring",
  ...DURATION_MESSAGE_KEYS,
  ...BOOKING_QUESTIONS_MESSAGE_KEYS,
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
    const redirect = form.successRedirectUrl?.trim() || null;
    const invalid =
      limitsErrorKey(form) ??
      seatsErrorKey(form) ??
      (form.bookerLayouts && !form.bookerLayouts.enabledLayouts.length
        ? "bookerlayout_error_min_one_enabled"
        : null) ??
      (form.multipleDuration && !form.multipleDuration.length
        ? "event_setup_multiple_duration_error"
        : null) ??
      (form.recurringEvent && form.maxActiveBookingsPerBooker
        ? "recurring_event_doesnt_support_booker_booking_limit"
        : null) ??
      (redirect && !/^https?:\/\/\S+$/i.test(redirect) ? "url_validation_error" : null);
    if (invalid) {
      setStatus({ kind: "error", key: invalid });
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await updateEventType({
        data: {
          id,
          eventType: { ...form, successRedirectUrl: redirect, eventName: form.eventName?.trim() || null },
        },
      });
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
          <DurationEditor form={form} set={set} t={t} />
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

      <Section title={t("booking_questions_title")}>
        <BookingQuestionsEditor
          value={form.bookingFields}
          onChange={(fields) => set("bookingFields", fields)}
          t={t}
        />
      </Section>

      <Section title={t("layout")}>
        <label className="flex items-center gap-2 font-medium text-sm">
          <Switch
            checked={form.bookerLayouts !== null}
            onCheckedChange={(checked) => set("bookerLayouts", checked ? DEFAULT_BOOKER_LAYOUTS : null)}
          />
          {t("bookerlayout_override")}
        </label>
        {form.bookerLayouts && (
          <BookerLayoutSettings
            value={form.bookerLayouts}
            onChange={(layouts) => set("bookerLayouts", layouts)}
            t={t}
          />
        )}
      </Section>

      <Section title={t("recurring")}>
        <RecurringEditor form={form} set={set} t={t} />
      </Section>

      <Section title={t("event_limit_tab_title")}>
        <LimitsEditor form={form} set={set} t={t} />
      </Section>

      <Section title={t("advanced")}>
        <AdvancedEditor form={form} set={set} t={t} />
        <PrivateLinksEditor form={form} set={set} origin={origin} t={t} />
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
