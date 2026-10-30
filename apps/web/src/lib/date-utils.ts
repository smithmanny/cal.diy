import dayjs from "@calcom/dayjs";

/** "YYYY-MM-DD" of an instant as seen in `timeZone`. */
export function dateKeyInTimeZone(date: Date | string, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

/** `hour12` undefined follows the locale (e.g. 12-hour in en-US, 24-hour in de). */
export function formatTime(date: Date | string, timeZone: string, locale: string, hour12?: boolean): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit", hour12 }).format(
    new Date(date)
  );
}

export function localeUsesHour12(locale: string): boolean {
  return new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
}

/** Cal stores the preference as 12 or 24; anything else means "follow the locale". */
export function hour12FromTimeFormat(timeFormat: number | null | undefined): boolean | undefined {
  if (timeFormat === 12) return true;
  if (timeFormat === 24) return false;
  return undefined;
}

export function formatLongDate(date: Date | string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "full" }).format(new Date(date));
}

export function formatMonth(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

/** The instants where a calendar month starts and ends in `timeZone`. */
export function monthRangeInTimeZone(
  year: number,
  month: number,
  timeZone: string
): { from: Date; to: Date } {
  const midnightOnFirst = (y: number, m: number) =>
    dayjs.tz(`${y}-${String(m).padStart(2, "0")}-01 00:00`, timeZone).toDate();
  // Each boundary is resolved on its own: adding a month to a zoned dayjs keeps the old UTC
  // offset, which is wrong whenever DST changes during the month.
  return {
    from: midnightOnFirst(year, month),
    to: month === 12 ? midnightOnFirst(year + 1, 1) : midnightOnFirst(year, month + 1),
  };
}

/** Weeks (Sunday first) covering the month; null pads days outside it. */
/** Weeks of YYYY-MM-DD cells (null for padding), each starting on `weekStartDay` (0 = Sunday). */
/** A YYYY-MM-DD key moved by whole calendar days. */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** From midnight on `first` to midnight `count` days later, each resolved in the zone (DST-safe). */
export function dayRangeInTimeZone(first: string, count: number, timeZone: string): { from: Date; to: Date } {
  return {
    from: dayjs.tz(`${first} 00:00`, timeZone).toDate(),
    to: dayjs.tz(`${addDaysToKey(first, count)} 00:00`, timeZone).toDate(),
  };
}

export function monthGrid(year: number, month: number, weekStartDay = 0): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (first.getUTCDay() - weekStartDay + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
