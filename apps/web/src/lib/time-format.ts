export type TimeRange = { start: string; end: string };

/** "HH:mm" → localized time, e.g. "9:00 AM" (en) or "09:00" (de). "23:59" is shown as-is, like Cal. */
export function formatTimeOfDay(time: string, locale: string, hour12?: boolean): string {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    hour12,
  }).format(new Date(Date.UTC(1970, 0, 1, hours, minutes)));
}

/** Localized weekday names starting at `firstDay` (0 = Sunday; 2021-08-01 was a Sunday). */
export function weekdayNames(locale: string, width: "long" | "short" = "short", firstDay = 0): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, day) =>
    format.format(new Date(Date.UTC(2021, 7, 1 + ((day + firstDay) % 7))))
  );
}

export const WEEK_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Cal stores the week start as an English day name; unknown values fall back to Sunday. */
export function weekStartIndex(weekStart: string | null | undefined): number {
  const index = WEEK_DAY_NAMES.indexOf(weekStart as (typeof WEEK_DAY_NAMES)[number]);
  return index === -1 ? 0 : index;
}

/**
 * One line per group of consecutive weekdays with the same hours, e.g. "Mon - Fri, 9:00 AM - 5:00 PM".
 */
export function summarizeWeeklyHours(weeklyHours: TimeRange[][], locale: string, hour12?: boolean): string[] {
  const names = weekdayNames(locale);
  const key = (ranges: TimeRange[]) => ranges.map((r) => `${r.start}-${r.end}`).join(",");
  const lines: string[] = [];
  let day = 0;
  while (day < 7) {
    const ranges = weeklyHours[day];
    if (!ranges.length) {
      day++;
      continue;
    }
    let last = day;
    while (last + 1 < 7 && key(weeklyHours[last + 1]) === key(ranges)) last++;
    const days = last === day ? names[day] : `${names[day]} - ${names[last]}`;
    const times = ranges
      .map((r) => `${formatTimeOfDay(r.start, locale, hour12)} - ${formatTimeOfDay(r.end, locale, hour12)}`)
      .join(", ");
    lines.push(`${days}, ${times}`);
    day = last + 1;
  }
  return lines;
}

/** Every 15 minutes through the day, plus Cal's "23:59" end-of-day option. */
export const TIME_OPTIONS: string[] = [
  ...Array.from({ length: 96 }, (_, index) => {
    const minutes = index * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }),
  "23:59",
];
