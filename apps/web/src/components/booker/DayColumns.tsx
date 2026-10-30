import { Button } from "@coss/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FormError } from "~/components/AuthCard";
import { formatTime, localeUsesHour12 } from "~/lib/date-utils";
import { useHour12 } from "~/lib/hour-cycle";
import type { TFunction } from "~/lib/i18n";
import type { OutOfOfficeDayDto } from "~/server/bookings/types";
import { HourCycleToggle } from "./HourCycleToggle";

function dayHeading(day: string, locale: string): { weekday: string; date: string } {
  const date = new Date(`${day}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date),
    date: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(date),
  };
}

function DayColumn({
  day,
  slots,
  away,
  loading,
  onSelectSlot,
  format,
  seats,
  locale,
  t,
}: {
  day: string;
  slots: string[];
  away: OutOfOfficeDayDto | undefined;
  loading: boolean;
  onSelectSlot: (slot: string) => void;
  format: (slot: string) => string;
  seats?: { total: number; taken: Record<string, number> } | null;
  locale: string;
  t: TFunction;
}) {
  const heading = dayHeading(day, locale);
  let content: ReactNode = null;
  if (!loading && !slots.length)
    content = (
      <p className="text-center text-muted-foreground text-xs">
        {away ? t("ooo_user_is_ooo", { displayName: away.displayName ?? "" }) : "–"}
      </p>
    );
  else if (!loading)
    content = slots.map((slot) => {
      const left = seats ? seats.total - (seats.taken[slot] ?? 0) : null;
      return (
        <Button key={slot} variant="outline" size="sm" onClick={() => onSelectSlot(slot)}>
          {format(slot)}
          {left !== null && (
            <span className="sr-only">{`${left} ${t("seats_available", { count: left })}`}</span>
          )}
        </Button>
      );
    });
  return (
    <section aria-label={`${heading.weekday} ${heading.date}`} className="flex flex-col gap-2">
      <h3 className="text-center text-sm">
        <span className="block text-muted-foreground text-xs uppercase">{heading.weekday}</span>
        <span className="font-medium">{heading.date}</span>
      </h3>
      {content}
    </section>
  );
}

/**
 * Cal's week and column views: several days side by side, each with its times. Week view pages
 * through calendar weeks, column view through the next days.
 */
export function DayColumns({
  days,
  timeZone,
  locale,
  loading,
  slotsByDate,
  outOfOffice,
  errorKey,
  onMove,
  onSelectSlot,
  onHour12Change,
  seats,
  t,
}: {
  days: string[];
  timeZone: string | null;
  locale: string;
  loading: boolean;
  slotsByDate: Map<string, string[]>;
  outOfOffice: Record<string, OutOfOfficeDayDto>;
  errorKey: string | null;
  onMove: (pages: number) => void;
  onSelectSlot: (slot: string) => void;
  onHour12Change: (hour12: boolean) => void;
  seats?: { total: number; taken: Record<string, number> } | null;
  t: TFunction;
}) {
  const hour12 = useHour12() ?? localeUsesHour12(locale);
  if (!timeZone || !days.length) return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("view_previous_week")}
            onClick={() => onMove(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("view_next_week")} onClick={() => onMove(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
        <HourCycleToggle hour12={hour12} onChange={onHour12Change} t={t} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => (
          <DayColumn
            key={day}
            day={day}
            slots={slotsByDate.get(day) ?? []}
            away={outOfOffice[day]}
            loading={loading}
            onSelectSlot={onSelectSlot}
            format={(slot) => formatTime(slot, timeZone, locale, hour12)}
            seats={seats}
            locale={locale}
            t={t}
          />
        ))}
      </div>
      {loading && <p className="text-muted-foreground text-sm">{t("loading")}</p>}
      <FormError message={errorKey && t(errorKey)} />
    </div>
  );
}
