import {
  type IntervalLimit,
  type IntervalLimitKey,
  isIntervalLimitOrderValid,
} from "@calcom/scheduling/limits";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { TrashIcon } from "lucide-react";
import type { ReactNode } from "react";
import { selectClass } from "~/components/availability/TimeSelect";
import type { TFunction } from "~/lib/i18n";
import type { EventTypeInput } from "~/server/event-types/types";
import { Field, type SetField } from "./EditorLayout";

const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const INTERVAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120];
const LIMIT_KEYS: { key: IntervalLimitKey; labelKey: string }[] = [
  { key: "PER_DAY", labelKey: "per_day" },
  { key: "PER_WEEK", labelKey: "per_week" },
  { key: "PER_MONTH", labelKey: "per_month" },
  { key: "PER_YEAR", labelKey: "per_year" },
];

function ToggleBlock({
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
        <span className="flex flex-col">
          <span className="font-medium">{title}</span>
          {description && <span className="text-muted-foreground">{description}</span>}
        </span>
      </label>
      {checked && children && <div className="ps-10">{children}</div>}
    </div>
  );
}

/** Cal's per-day/week/month/year rows; one row per period, at most once each. */
function IntervalLimitsEditor({
  value,
  onChange,
  unitLabel,
  t,
}: {
  value: IntervalLimit;
  onChange: (value: IntervalLimit) => void;
  unitLabel?: string;
  t: TFunction;
}) {
  const used = LIMIT_KEYS.filter(({ key }) => value[key] !== undefined);
  const next = LIMIT_KEYS.find(({ key }) => value[key] === undefined);
  return (
    <div className="flex flex-col gap-2">
      {used.map(({ key, labelKey }) => (
        <div key={key} className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              className="w-24"
              value={value[key]}
              onChange={(event) => onChange({ ...value, [key]: Math.max(1, Number(event.target.value)) })}
            />
            {unitLabel && <span>{unitLabel}</span>}
            <span>{t(labelKey)}</span>
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("delete")}
            onClick={() => {
              const { [key]: _removed, ...rest } = value;
              onChange(rest);
            }}>
            <TrashIcon />
          </Button>
        </div>
      ))}
      {next && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            // A new, larger period starts at the largest existing value so the order stays valid.
            const largest = Math.max(
              1,
              ...Object.values(value).filter((v): v is number => typeof v === "number")
            );
            onChange({ ...value, [next.key]: largest });
          }}>
          {t("add_limit")}
        </Button>
      )}
    </div>
  );
}

type EditorProps = { form: EventTypeInput; set: SetField; t: TFunction };

function TimingFields({ form, set, t }: EditorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("before_event")}>
        <select
          className={selectClass}
          value={form.beforeEventBuffer}
          onChange={(e) => set("beforeEventBuffer", Number(e.target.value))}>
          {BUFFER_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 0 ? t("event_buffer_default") : `${minutes} ${t("minutes")}`}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("after_event")}>
        <select
          className={selectClass}
          value={form.afterEventBuffer}
          onChange={(e) => set("afterEventBuffer", Number(e.target.value))}>
          {BUFFER_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 0 ? t("event_buffer_default") : `${minutes} ${t("minutes")}`}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${t("minimum_booking_notice")} (${t("minutes")})`}>
        <Input
          type="number"
          min={0}
          value={form.minimumBookingNotice}
          onChange={(e) => set("minimumBookingNotice", Number(e.target.value))}
        />
      </Field>
      <Field label={t("slot_interval")}>
        <select
          className={selectClass}
          value={form.slotInterval ?? ""}
          onChange={(e) => set("slotInterval", e.target.value ? Number(e.target.value) : null)}>
          <option value="">{t("slot_interval_default")}</option>
          {INTERVAL_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} {t("minutes")}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function FuturePeriod({ form, set, t }: EditorProps) {
  const setPeriod = (periodType: EventTypeInput["periodType"]) => {
    set("periodType", periodType);
    if ((periodType === "ROLLING" || periodType === "ROLLING_WINDOW") && form.periodDays === null)
      set("periodDays", 30);
    if (periodType === "RANGE" && !form.periodStartDate) {
      const today = new Date().toISOString().slice(0, 10);
      set("periodStartDate", today);
      set("periodEndDate", today);
    }
  };
  return (
    <ToggleBlock
      title={t("limit_future_bookings")}
      checked={form.periodType !== "UNLIMITED"}
      onCheckedChange={(on) => setPeriod(on ? "ROLLING" : "UNLIMITED")}>
      <fieldset className="flex flex-col gap-3 text-sm">
        <label className="flex flex-wrap items-center gap-2">
          <input type="radio" checked={form.periodType === "ROLLING"} onChange={() => setPeriod("ROLLING")} />
          <Input
            type="number"
            min={1}
            max={3650}
            className="w-24"
            aria-label={t("into_the_future")}
            value={form.periodDays ?? 30}
            onChange={(e) => set("periodDays", Number(e.target.value))}
          />
          <select
            className={selectClass}
            value={form.periodCountCalendarDays ? "calendar" : "business"}
            onChange={(e) => set("periodCountCalendarDays", e.target.value === "calendar")}>
            <option value="business">{t("business_days")}</option>
            <option value="calendar">{t("calendar_days")}</option>
          </select>
          <span>{t("into_the_future")}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={form.periodType === "ROLLING_WINDOW"}
            onChange={() => setPeriod("ROLLING_WINDOW")}
          />
          {t("always_show_x_days", { x: form.periodDays ?? 30 })}
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <input type="radio" checked={form.periodType === "RANGE"} onChange={() => setPeriod("RANGE")} />
          {t("within_date_range")}
          {form.periodType === "RANGE" && (
            <>
              <Input
                type="date"
                className="w-40"
                aria-label={`${t("within_date_range")} 1`}
                value={form.periodStartDate ?? ""}
                onChange={(e) => set("periodStartDate", e.target.value || null)}
              />
              <Input
                type="date"
                className="w-40"
                aria-label={`${t("within_date_range")} 2`}
                value={form.periodEndDate ?? ""}
                onChange={(e) => set("periodEndDate", e.target.value || null)}
              />
            </>
          )}
        </label>
      </fieldset>
    </ToggleBlock>
  );
}

export const LIMITS_MESSAGE_KEYS = [
  "minutes",
  "minimum_booking_notice",
  "before_event",
  "after_event",
  "event_buffer_default",
  "slot_interval",
  "slot_interval_default",
  "limit_future_bookings",
  "into_the_future",
  "business_days",
  "calendar_days",
  "always_show_x_days",
  "within_date_range",
  "limit_booking_frequency",
  "limit_total_booking_duration",
  "limit_total_booking_duration_description",
  "add_limit",
  "per_day",
  "per_week",
  "per_month",
  "per_year",
  "offset_toggle",
  "offset_toggle_description",
  "offset_start",
  "only_show_first_available_slot",
  "only_show_first_available_slot_description",
  "booker_upcoming_limit",
  "reschedule_last_booking_offer",
  "event_setup_booking_limits_error",
  "event_setup_duration_limits_error",
  "start_date_must_be_before_end_date",
  "delete",
];

export function LimitsEditor({ form, set, t }: EditorProps) {
  return (
    <>
      <TimingFields form={form} set={set} t={t} />

      <ToggleBlock
        title={t("limit_booking_frequency")}
        checked={form.bookingLimits !== null}
        onCheckedChange={(on) => set("bookingLimits", on ? { PER_DAY: 1 } : null)}>
        <IntervalLimitsEditor
          value={form.bookingLimits ?? {}}
          onChange={(v) => set("bookingLimits", v)}
          t={t}
        />
      </ToggleBlock>

      <ToggleBlock
        title={t("limit_total_booking_duration")}
        description={t("limit_total_booking_duration_description")}
        checked={form.durationLimits !== null}
        onCheckedChange={(on) => set("durationLimits", on ? { PER_DAY: 60 } : null)}>
        <IntervalLimitsEditor
          value={form.durationLimits ?? {}}
          onChange={(v) => set("durationLimits", v)}
          unitLabel={t("minutes")}
          t={t}
        />
      </ToggleBlock>

      <ToggleBlock
        title={t("only_show_first_available_slot")}
        description={t("only_show_first_available_slot_description")}
        checked={form.onlyShowFirstAvailableSlot}
        onCheckedChange={(on) => set("onlyShowFirstAvailableSlot", on)}
      />

      <ToggleBlock
        title={t("booker_upcoming_limit")}
        checked={form.maxActiveBookingsPerBooker !== null}
        onCheckedChange={(on) => set("maxActiveBookingsPerBooker", on ? 1 : null)}>
        <div className="flex flex-col gap-2">
          <Input
            type="number"
            min={1}
            className="w-24"
            aria-label={t("booker_upcoming_limit")}
            value={form.maxActiveBookingsPerBooker ?? 1}
            onChange={(e) => set("maxActiveBookingsPerBooker", Math.max(1, Number(e.target.value)))}
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.maxActiveBookingPerBookerOfferReschedule}
              onCheckedChange={(on) => set("maxActiveBookingPerBookerOfferReschedule", on)}
            />
            {t("reschedule_last_booking_offer")}
          </label>
        </div>
      </ToggleBlock>

      <FuturePeriod form={form} set={set} t={t} />

      <ToggleBlock
        title={t("offset_toggle")}
        description={t("offset_toggle_description")}
        checked={form.offsetStart > 0}
        onCheckedChange={(on) => set("offsetStart", on ? 15 : 0)}>
        <div className="flex items-center gap-2 text-sm">
          <span>{t("offset_start")}</span>
          <Input
            type="number"
            min={1}
            max={1440}
            className="w-24"
            aria-label={t("offset_start")}
            value={form.offsetStart}
            onChange={(e) => set("offsetStart", Math.max(0, Number(e.target.value)))}
          />
          <span>{t("minutes")}</span>
        </div>
      </ToggleBlock>
    </>
  );
}

/** The translation key for the first problem in the limits, if any; checked before saving. */
export function limitsErrorKey(form: EventTypeInput): string | null {
  if (form.bookingLimits && !isIntervalLimitOrderValid(form.bookingLimits))
    return "event_setup_booking_limits_error";
  if (form.durationLimits && !isIntervalLimitOrderValid(form.durationLimits))
    return "event_setup_duration_limits_error";
  if (
    form.periodType === "RANGE" &&
    (!form.periodStartDate || !form.periodEndDate || form.periodStartDate > form.periodEndDate)
  ) {
    return "start_date_must_be_before_end_date";
  }
  return null;
}
