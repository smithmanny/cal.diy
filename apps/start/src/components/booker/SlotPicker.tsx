import { Button } from "@coss/ui/components/button";
import { useState } from "react";
import { dateKeyInTimeZone, formatLongDate, formatTime } from "~/lib/date-utils";
import type { TFunction } from "~/lib/i18n";
import { FormError } from "../AuthCard";
import { BookingCalendar } from "./BookingCalendar";
import type { MonthCursor } from "./useMonthSlots";

export function SlotPicker({
  cursor,
  timeZone,
  locale,
  loading,
  slotsByDate,
  errorKey,
  onMoveMonth,
  onSelectSlot,
  t,
}: {
  cursor: MonthCursor | null;
  timeZone: string | null;
  locale: string;
  loading: boolean;
  slotsByDate: Map<string, string[]>;
  errorKey: string | null;
  onMoveMonth: (delta: number) => void;
  onSelectSlot: (slot: string) => void;
  t: TFunction;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
        onChangeMonth={(delta) => {
          setSelectedDate(null);
          onMoveMonth(delta);
        }}
        t={t}
      />
      <div className="flex flex-col gap-2">
        {loading && <p className="text-muted-foreground text-sm">{t("loading")}</p>}
        {!loading && slotsByDate.size === 0 && (
          <p className="text-muted-foreground text-sm">{t("no_available_slots")}</p>
        )}
        {selectedDate && (
          <>
            <p className="font-medium text-sm">
              {formatLongDate(`${selectedDate}T12:00:00Z`, "UTC", locale)}
            </p>
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {(slotsByDate.get(selectedDate) ?? []).map((slot) => (
                <li key={slot}>
                  <Button variant="outline" className="w-full" onClick={() => onSelectSlot(slot)}>
                    {formatTime(slot, timeZone, locale)}
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
