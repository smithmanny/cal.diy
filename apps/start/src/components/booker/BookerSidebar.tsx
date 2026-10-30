import { Input } from "@coss/ui/components/input";
import { ClockIcon, CreditCardIcon, GlobeIcon, MapPinIcon, RepeatIcon } from "lucide-react";
import type { TFunction } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { formatMoney } from "~/lib/money";
import { recurringSummary } from "~/lib/recurring";
import type { PublicEventDto } from "~/server/bookings/types";
import { TimeZoneSelect } from "../TimeZoneSelect";

/** Cal's "Every week for [n] occurrences", where the booker can book fewer than the host allows. */
function RecurringCount({
  rule,
  value,
  onChange,
  disabled,
  t,
}: {
  rule: { freq: number; interval: number; count: number };
  value: number;
  onChange: (count: number) => void;
  disabled: boolean;
  t: TFunction;
}) {
  const [before] = recurringSummary({ ...rule, count: value }, t).split(` ${value} `);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <RepeatIcon className="size-4 text-muted-foreground" />
      {before}
      <Input
        type="number"
        min={1}
        max={rule.count}
        className="w-16"
        aria-label={t("occurrence", { count: 2 })}
        disabled={disabled}
        value={value}
        onChange={(event) =>
          onChange(Math.min(rule.count, Math.max(1, Math.floor(Number(event.target.value) || 1))))
        }
      />
      {t("occurrence", { count: value })}
    </label>
  );
}

export function BookerSidebar({
  event,
  rescheduling,
  timeZone,
  onTimeZoneChange,
  duration,
  onDurationChange,
  recurringCount,
  onRecurringCountChange,
  locale,
  t,
}: {
  event: PublicEventDto;
  rescheduling: boolean;
  timeZone: string | null;
  onTimeZoneChange: (timeZone: string) => void;
  duration: number;
  onDurationChange: (minutes: number) => void;
  recurringCount: number;
  onRecurringCountChange: (count: number) => void;
  locale: string;
  t: TFunction;
}) {
  const { eventType, host } = event;
  return (
    <aside className="flex flex-col gap-3 border-b p-6 md:border-r md:border-b-0">
      <p className="text-muted-foreground text-sm">{host.name ?? host.username}</p>
      <h1 className="font-heading text-xl">{eventType.title}</h1>
      {rescheduling && <p className="font-medium text-sm">{t("reschedule_booking")}</p>}
      {eventType.description && (
        <p className="whitespace-pre-line text-muted-foreground text-sm">{eventType.description}</p>
      )}
      {eventType.durations.length > 1 ? (
        <div
          role="radiogroup"
          aria-label={t("duration")}
          className="flex flex-wrap items-center gap-1.5 text-sm">
          <ClockIcon className="size-4 text-muted-foreground" />
          {eventType.durations.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={duration === minutes}
              onClick={() => onDurationChange(minutes)}
              className={`rounded-md border px-2 py-0.5 ${duration === minutes ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {t("multiple_duration_mins", { count: minutes })}
            </button>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm">
          <ClockIcon className="size-4 text-muted-foreground" />
          {eventType.length} {t("minutes")}
        </p>
      )}
      {eventType.locations.map((location) => (
        <p key={location.type} className="flex items-center gap-2 text-sm">
          <MapPinIcon className="size-4 text-muted-foreground" />
          {location.address ?? t(LOCATION_LABEL_KEYS[location.type] ?? location.type)}
        </p>
      ))}
      {eventType.recurringEvent && (
        <RecurringCount
          rule={eventType.recurringEvent}
          value={recurringCount}
          onChange={onRecurringCountChange}
          disabled={rescheduling}
          t={t}
        />
      )}
      {eventType.requiresConfirmation && (
        <p className="text-muted-foreground text-xs">{t("requires_confirmation")}</p>
      )}
      {eventType.price && (
        <p className="flex items-center gap-2 text-sm">
          <CreditCardIcon className="size-4 text-muted-foreground" aria-label={t("price")} />
          {formatMoney(eventType.price.amount, eventType.price.currency, locale)}
        </p>
      )}
      {timeZone && (
        <label className="mt-2 flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <GlobeIcon className="size-4" />
            {t("timezone")}
          </span>
          {eventType.lockedTimeZone ? (
            <span>{timeZone}</span>
          ) : (
            <TimeZoneSelect value={timeZone} onChange={onTimeZoneChange} />
          )}
        </label>
      )}
    </aside>
  );
}
