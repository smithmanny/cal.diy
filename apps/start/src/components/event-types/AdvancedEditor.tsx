import { Input } from "@coss/ui/components/input";
import { useHydrated } from "@tanstack/react-router";
import { selectClass } from "~/components/availability/TimeSelect";
import { TimeZoneSelect } from "~/components/TimeZoneSelect";
import { browserTimeZone } from "~/lib/date-utils";
import type { TFunction } from "~/lib/i18n";
import { SUPPORTED_LOCALES } from "~/lib/locales";
import type { EventTypeInput } from "~/server/event-types/types";
import { aroundSlot, Field, type SetField, ToggleBlock, withoutLinks } from "./EditorLayout";

type EditorProps = { form: EventTypeInput; set: SetField; t: TFunction };

// Cal's event name variables; booking question identifiers work too.
const EVENT_NAME_VARIABLES = [
  "{Event type title}",
  "{Organiser}",
  "{Scheduler}",
  "{Location}",
  "{Event duration}",
  "{Organiser first name}",
  "{Scheduler first name}",
];

const DEFAULT_THRESHOLD = { time: 30, unit: "minutes" as const };

function ConfirmationOptions({ form, set, t }: EditorProps) {
  const [before, after] = aroundSlot(t("when_booked_with_less_than_notice"));
  const threshold = form.requiresConfirmationThreshold;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={threshold !== null}
          onChange={(event) =>
            set("requiresConfirmationThreshold", event.target.checked ? DEFAULT_THRESHOLD : null)
          }
        />
        {before}
        <Input
          type="number"
          min={1}
          className="w-20"
          aria-label={t("minimum_booking_notice")}
          disabled={!threshold}
          value={(threshold ?? DEFAULT_THRESHOLD).time}
          onChange={(event) =>
            set("requiresConfirmationThreshold", {
              ...(threshold ?? DEFAULT_THRESHOLD),
              time: Math.max(1, Math.floor(Number(event.target.value) || 1)),
            })
          }
        />
        <select
          className={selectClass}
          aria-label={t("hours")}
          disabled={!threshold}
          value={(threshold ?? DEFAULT_THRESHOLD).unit}
          onChange={(event) =>
            set("requiresConfirmationThreshold", {
              ...(threshold ?? DEFAULT_THRESHOLD),
              unit: event.target.value === "hours" ? "hours" : "minutes",
            })
          }>
          <option value="minutes">{t("minutes")}</option>
          <option value="hours">{t("hours")}</option>
        </select>
        {after}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.requiresConfirmationWillBlockSlot}
          onChange={(event) => set("requiresConfirmationWillBlockSlot", event.target.checked)}
        />
        {t("requires_confirmation_will_block_slot_description")}
      </label>
    </div>
  );
}

function RedirectOptions({ form, set, t }: EditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        type="url"
        aria-label={t("redirect_url")}
        placeholder={t("external_redirect_url")}
        value={form.successRedirectUrl ?? ""}
        onChange={(event) => set("successRedirectUrl", event.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.forwardParamsSuccessRedirect}
          onChange={(event) => set("forwardParamsSuccessRedirect", event.target.checked)}
        />
        {t("forward_params_redirect")}
      </label>
      <p className="text-muted-foreground text-sm">{t("redirect_url_warning")}</p>
    </div>
  );
}

const DEFAULT_COLORS = { lightEventTypeColor: "#292929", darkEventTypeColor: "#fafafa" };

/** A language in its own words, so visitors recognize theirs. */
function languageName(locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

function ColorFields({ form, set, t }: EditorProps) {
  const colors = form.eventTypeColor ?? DEFAULT_COLORS;
  return (
    <div className="flex flex-wrap gap-4">
      {(
        [
          ["lightEventTypeColor", "light_event_type_color"],
          ["darkEventTypeColor", "dark_event_type_color"],
        ] as const
      ).map(([key, labelKey]) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input
            type="color"
            className="size-8 cursor-pointer rounded border"
            value={colors[key]}
            onChange={(event) => set("eventTypeColor", { ...colors, [key]: event.target.value })}
          />
          {t(labelKey)}
        </label>
      ))}
    </div>
  );
}

export function AdvancedEditor({ form, set, t }: EditorProps) {
  // Node and browsers ship different ICU data, so names would differ between SSR and hydration.
  const hydrated = useHydrated();
  return (
    <div className="flex flex-col gap-5">
      <Field label={t("event_name_in_calendar")}>
        <Input
          value={form.eventName ?? ""}
          maxLength={1000}
          placeholder={t("event_between_users", {
            eventName: form.title,
            host: t("organizer"),
            attendeeName: t("attendee_name_variable"),
          })}
          onChange={(event) => set("eventName", event.target.value)}
        />
        <span className="font-normal text-muted-foreground text-xs">
          {t("available_variables")}: {EVENT_NAME_VARIABLES.join(", ")}
        </span>
      </Field>
      <ToggleBlock
        title={t("requires_confirmation")}
        description={withoutLinks(t("requires_confirmation_description"))}
        checked={form.requiresConfirmation}
        onCheckedChange={(checked) => set("requiresConfirmation", checked)}>
        <ConfirmationOptions form={form} set={set} t={t} />
      </ToggleBlock>
      <ToggleBlock
        title={t("disable_cancelling")}
        description={withoutLinks(t("description_disable_cancelling"))}
        checked={form.disableCancelling}
        onCheckedChange={(checked) => set("disableCancelling", checked)}
      />
      <ToggleBlock
        title={t("disable_rescheduling")}
        description={withoutLinks(t("description_disable_rescheduling"))}
        checked={form.disableRescheduling}
        onCheckedChange={(checked) => set("disableRescheduling", checked)}
      />
      {!form.disableRescheduling && (
        <Field label={`${t("minimum_reschedule_notice")} (${t("minutes")})`}>
          <Input
            type="number"
            min={1}
            className="max-w-40"
            value={form.minimumRescheduleNotice ?? ""}
            onChange={(event) =>
              set(
                "minimumRescheduleNotice",
                event.target.value ? Math.max(1, Math.floor(Number(event.target.value))) : null
              )
            }
          />
          <span className="font-normal text-muted-foreground text-xs">
            {t("minimum_reschedule_notice_description")}
          </span>
        </Field>
      )}
      <ToggleBlock
        title={t("redirect_success_booking")}
        description={t("redirect_url_description")}
        checked={form.successRedirectUrl !== null}
        onCheckedChange={(checked) => set("successRedirectUrl", checked ? "" : null)}>
        <RedirectOptions form={form} set={set} t={t} />
      </ToggleBlock>
      <ToggleBlock
        title={t("disable_notes")}
        description={withoutLinks(t("disable_notes_description"))}
        checked={form.hideCalendarNotes}
        onCheckedChange={(checked) => set("hideCalendarNotes", checked)}
      />
      <ToggleBlock
        title={t("hide_calendar_event_details")}
        description={t("description_hide_calendar_event_details")}
        checked={form.hideCalendarEventDetails}
        onCheckedChange={(checked) => set("hideCalendarEventDetails", checked)}
      />
      <ToggleBlock
        title={t("hide_organizer_email")}
        description={withoutLinks(t("hide_organizer_email_description"))}
        checked={form.hideOrganizerEmail}
        onCheckedChange={(checked) => set("hideOrganizerEmail", checked)}
      />
      <ToggleBlock
        title={t("lock_timezone_toggle_on_booking_page")}
        description={withoutLinks(t("description_lock_timezone_toggle_on_booking_page"))}
        checked={form.lockTimeZoneToggleOnBookingPage}
        onCheckedChange={(checked) => {
          set("lockTimeZoneToggleOnBookingPage", checked);
          if (checked && !form.lockedTimeZone) set("lockedTimeZone", browserTimeZone());
        }}>
        <Field label={t("timezone")}>
          <TimeZoneSelect
            value={form.lockedTimeZone ?? browserTimeZone()}
            onChange={(zone) => set("lockedTimeZone", zone)}
          />
        </Field>
      </ToggleBlock>
      <ToggleBlock
        title={t("event_type_color")}
        description={t("event_type_color_description")}
        checked={form.eventTypeColor !== null}
        onCheckedChange={(checked) => set("eventTypeColor", checked ? DEFAULT_COLORS : null)}>
        <ColorFields form={form} set={set} t={t} />
      </ToggleBlock>
      <Field label={t("interface_language")}>
        <select
          className={`${selectClass} max-w-sm`}
          value={form.interfaceLanguage ?? ""}
          onChange={(event) => set("interfaceLanguage", event.target.value || null)}>
          <option value="">{t("visitors_browser_language")}</option>
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {hydrated ? languageName(locale) : locale}
            </option>
          ))}
        </select>
        <span className="font-normal text-muted-foreground text-xs">
          {t("interface_language_description")}
        </span>
      </Field>
      <ToggleBlock
        title={t("hide_from_profile")}
        checked={form.hidden}
        onCheckedChange={(checked) => set("hidden", checked)}
      />
    </div>
  );
}

export const ADVANCED_MESSAGE_KEYS = [
  "event_name_in_calendar",
  "event_between_users",
  "organizer",
  "available_variables",
  "requires_confirmation",
  "requires_confirmation_description",
  "when_booked_with_less_than_notice",
  "minimum_booking_notice",
  "minutes",
  "hours",
  "requires_confirmation_will_block_slot_description",
  "disable_cancelling",
  "description_disable_cancelling",
  "disable_rescheduling",
  "description_disable_rescheduling",
  "minimum_reschedule_notice",
  "minimum_reschedule_notice_description",
  "redirect_success_booking",
  "redirect_url_description",
  "redirect_url",
  "external_redirect_url",
  "forward_params_redirect",
  "redirect_url_warning",
  "hide_from_profile",
  "disable_notes",
  "disable_notes_description",
  "hide_calendar_event_details",
  "description_hide_calendar_event_details",
  "hide_organizer_email",
  "hide_organizer_email_description",
  "lock_timezone_toggle_on_booking_page",
  "timezone",
  "description_lock_timezone_toggle_on_booking_page",
  "event_type_color",
  "event_type_color_description",
  "light_event_type_color",
  "dark_event_type_color",
  "interface_language",
  "interface_language_description",
  "visitors_browser_language",
  "url_validation_error",
  "attendee_name_variable",
];
