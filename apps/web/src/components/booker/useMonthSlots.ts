import { useEffect, useMemo, useState } from "react";
import type { BookerLayout } from "~/lib/booker-layouts";
import {
  addDaysToKey,
  browserTimeZone,
  dateKeyInTimeZone,
  dayRangeInTimeZone,
  monthRangeInTimeZone,
} from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { getAvailableSlots } from "~/server/bookings/functions";
import type { SlotsDto } from "~/server/bookings/types";

// Week and column views show this many days at a time.
const DAYS_PER_PAGE = 7;

/** The first day a week or column view shows: the week's start day, or today for columns. */
function firstDay(today: string, layout: BookerLayout, weekStartDay: number): string {
  if (layout !== "week_view") return today;
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysToKey(today, -((weekday - weekStartDay + 7) % 7));
}

export type MonthCursor = { year: number; month: number };

/**
 * Loads one month of slots in the visitor's time zone. The zone is only known in the browser,
 * so nothing loads until after hydration (rendering slots on the server would mismatch).
 */
export function useMonthSlots(query: {
  username: string;
  slug: string;
  rescheduleUid?: string;
  /** The event's locked zone, used instead of the browser's. */
  lockedTimeZone?: string | null;
  /** The length the booker picked, when the event offers several. */
  duration?: number;
  /** Month view loads a month; week and column views load DAYS_PER_PAGE days from `days`. */
  layout?: BookerLayout;
  weekStartDay?: number;
}) {
  const {
    username,
    slug,
    rescheduleUid,
    lockedTimeZone,
    duration,
    layout = "month_view",
    weekStartDay = 0,
  } = query;
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [cursor, setCursor] = useState<MonthCursor | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const [result, setResult] = useState<SlotsDto | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const zone = lockedTimeZone || browserTimeZone();
    const today = dateKeyInTimeZone(new Date(), zone);
    const [year, month] = today.split("-").map(Number);
    setTimeZone(zone);
    setCursor({ year, month });
    setDays(firstDay(today, layout, weekStartDay));
  }, [lockedTimeZone, layout, weekStartDay]);

  useEffect(() => {
    if (!timeZone || !cursor || !days) return;
    let cancelled = false;
    setResult(null);
    setErrorKey(null);
    const { from, to } =
      layout === "month_view"
        ? monthRangeInTimeZone(cursor.year, cursor.month, timeZone)
        : dayRangeInTimeZone(days, DAYS_PER_PAGE, timeZone);
    getAvailableSlots({
      data: {
        username,
        slug,
        from: from.toISOString(),
        to: to.toISOString(),
        timeZone,
        rescheduleUid,
        duration,
      },
    })
      .then((loaded) => {
        if (!cancelled) setResult(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        setResult({ slots: [], outOfOffice: {}, seats: null });
        setErrorKey(errorMessageKey(error));
      });
    return () => {
      cancelled = true;
    };
  }, [timeZone, cursor, days, layout, username, slug, rescheduleUid, duration]);

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

  function moveDays(pages: number) {
    setDays((current) => current && addDaysToKey(current, pages * DAYS_PER_PAGE));
  }

  return {
    timeZone,
    setTimeZone,
    cursor,
    moveMonth,
    /** The days a week or column view shows. */
    days: days ? Array.from({ length: DAYS_PER_PAGE }, (_, offset) => addDaysToKey(days, offset)) : [],
    moveDays,
    loading: result === null,
    slotsByDate,
    outOfOffice: result?.outOfOffice ?? {},
    seats: result?.seats ?? null,
    errorKey,
  };
}
