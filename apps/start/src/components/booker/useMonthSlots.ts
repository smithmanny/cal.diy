import { useEffect, useMemo, useState } from "react";
import { browserTimeZone, dateKeyInTimeZone, monthRangeInTimeZone } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { getAvailableSlots } from "~/server/bookings/functions";
import type { SlotsDto } from "~/server/bookings/types";

export type MonthCursor = { year: number; month: number };

/**
 * Loads one month of slots in the visitor's time zone. The zone is only known in the browser,
 * so nothing loads until after hydration (rendering slots on the server would mismatch).
 */
export function useMonthSlots(query: { username: string; slug: string; rescheduleUid?: string }) {
  const { username, slug, rescheduleUid } = query;
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [cursor, setCursor] = useState<MonthCursor | null>(null);
  const [result, setResult] = useState<SlotsDto | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const zone = browserTimeZone();
    const [year, month] = dateKeyInTimeZone(new Date(), zone).split("-").map(Number);
    setTimeZone(zone);
    setCursor({ year, month });
  }, []);

  useEffect(() => {
    if (!timeZone || !cursor) return;
    let cancelled = false;
    setResult(null);
    setErrorKey(null);
    const { from, to } = monthRangeInTimeZone(cursor.year, cursor.month, timeZone);
    getAvailableSlots({
      data: { username, slug, from: from.toISOString(), to: to.toISOString(), timeZone, rescheduleUid },
    })
      .then((loaded) => {
        if (!cancelled) setResult(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        setResult({ slots: [], outOfOffice: {} });
        setErrorKey(errorMessageKey(error));
      });
    return () => {
      cancelled = true;
    };
  }, [timeZone, cursor, username, slug, rescheduleUid]);

  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, string[]>();
    if (!result || !timeZone) return grouped;
    for (const slot of result.slots) {
      const key = dateKeyInTimeZone(slot, timeZone);
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    }
    return grouped;
  }, [result, timeZone]);

  function moveMonth(delta: number) {
    setCursor((current) => {
      if (!current) return current;
      const index = current.year * 12 + (current.month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  return {
    timeZone,
    setTimeZone,
    cursor,
    moveMonth,
    loading: result === null,
    slotsByDate,
    outOfOffice: result?.outOfOffice ?? {},
    errorKey,
  };
}
