import { Button } from "@coss/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { formatMonth, monthGrid } from "~/lib/date-utils";
import type { TFunction } from "~/lib/i18n";
import { weekdayNames } from "~/lib/time-format";

function dayClass(selected: boolean, available: boolean): string {
  if (selected) return "bg-primary text-primary-foreground";
  if (available) return "bg-accent hover:bg-accent/70";
  return "text-muted-foreground/60";
}

export function BookingCalendar({
  year,
  month,
  locale,
  availableDates,
  selectedDate,
  onSelectDate,
  onChangeMonth,
  canGoBack,
  weekStartDay,
  t,
}: {
  year: number;
  month: number;
  locale: string;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onChangeMonth: (delta: number) => void;
  canGoBack: boolean;
  /** 0 = Sunday. */
  weekStartDay: number;
  t: TFunction;
}) {
  const weekdays = weekdayNames(locale, "short", weekStartDay);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{formatMonth(year, month, locale)}</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("view_previous_month")}
            disabled={!canGoBack}
            onClick={() => onChangeMonth(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("view_next_month")}
            onClick={() => onChangeMonth(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th key={day} className="font-normal text-muted-foreground text-xs uppercase">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(year, month, weekStartDay).map((week) => (
            <tr key={week.find(Boolean)}>
              {week.map((date, index) => {
                // biome-ignore lint/suspicious/noArrayIndexKey: padding cells are purely positional
                if (!date) return <td key={`pad-${index}`} />;
                const available = availableDates.has(date);
                const selected = date === selectedDate;
                return (
                  <td key={date}>
                    <button
                      type="button"
                      disabled={!available}
                      aria-pressed={selected}
                      aria-label={date}
                      onClick={() => onSelectDate(date)}
                      className={`aspect-square w-full rounded-md font-medium transition-colors ${dayClass(selected, available)}`}>
                      {Number(date.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
