import { Button } from "@coss/ui/components/button";
import { useState } from "react";
import { dateKeyInTimeZone, formatLongDate, formatTime, localeUsesHour12 } from "~/lib/date-utils";
import { useHour12 } from "~/lib/hour-cycle";
import type { TFunction } from "~/lib/i18n";
import type { OutOfOfficeDayDto } from "~/server/bookings/types";
import { FormError } from "../AuthCard";
import { BookingCalendar } from "./BookingCalendar";
import { OutOfOfficeNotice } from "./OutOfOfficeNotice";
import type { MonthCursor } from "./useMonthSlots";

export function SlotPicker({
  cursor,
  timeZone,
  locale,
  loading,
  slotsByDate,
  outOfOffice,
  errorKey,
  onMoveMonth,
  onSelectSlot,
  weekStartDay,
  onHour12Change,
  t,
}: {
  cursor: MonthCursor | null;
  timeZone: string | null;
  locale: string;
  loading: boolean;
  slotsByDate: Map<string, string[]>;
  outOfOffice: Record<string, OutOfOfficeDayDto>;
  errorKey: string | null;
  onMoveMonth: (delta: number) => void;
  onSelectSlot: (slot: string) => void;
  weekStartDay: number;
  onHour12Change: (hour12: boolean) => void;
  t: TFunction;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const hour12 = useHour12() ?? localeUsesHour12(locale);
  if (!cursor || !timeZone) return <p className="text-muted-foreground text-sm">{t("loading")}</p>;

  const today = dateKeyInTimeZone(new Date(), timeZone);
  const monthKey = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_12rem]">
      <BookingCalendar
        year={cursor.year}
        month={cursor.month}
        locale={locale}
        availableDates={new Set([...slotsByDate.keys()].filter((date) => date >= today))}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        canGoBack={monthKey > today.slice(0, 7)}
        weekStartDay={weekStartDay}
        awayDates={
          new Map(
            Object.entries(outOfOffice)
              .filter(([date]) => date >= today)
              .map(([date, day]) => [date, day.emoji])
          )
        }
        onChangeMonth={(delta) => {
          setSelectedDate(null);
          onMoveMonth(delta);
        }}
        t={t}
      />
      <div className="flex flex-col gap-2">
        {loading && <p className="text-muted-foreground text-sm">{t("loading")}</p>}
        {!loading && slotsByDate.size === 0 && Object.keys(outOfOffice).length === 0 && (
          <p className="text-muted-foreground text-sm">{t("no_available_slots")}</p>
        )}
        {selectedDate && outOfOffice[selectedDate] && (
          <OutOfOfficeNotice day={outOfOffice[selectedDate]} t={t} />
        )}
        {selectedDate && !outOfOffice[selectedDate] && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">
                {formatLongDate(`${selectedDate}T12:00:00Z`, "UTC", locale)}
              </p>
              <div
                role="group"
                aria-label={t("time_format")}
                className="flex rounded-md border p-0.5 text-xs">
                {[true, false].map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    aria-pressed={hour12 === option}
                    onClick={() => onHour12Change(option)}
                    className={`rounded px-1.5 py-0.5 ${hour12 === option ? "bg-accent font-medium" : "text-muted-foreground"}`}>
                    {option ? t("12_hour_short") : t("24_hour_short")}
                  </button>
                ))}
              </div>
            </div>
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {(slotsByDate.get(selectedDate) ?? []).map((slot) => (
                <li key={slot}>
                  <Button variant="outline" className="w-full" onClick={() => onSelectSlot(slot)}>
                    {formatTime(slot, timeZone, locale, hour12)}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        <FormError message={errorKey && t(errorKey)} />
      </div>
    </div>
  );
}
