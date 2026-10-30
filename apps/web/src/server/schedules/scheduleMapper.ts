import type { DateOverrideInput, ScheduleInput, TimeRange } from "./types";

function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const byStart = (a: TimeRange, b: TimeRange) => a.start.localeCompare(b.start);

function rangesError(
  ranges: TimeRange[]
): "error_end_time_before_start_time" | "overlapping_time_ranges" | null {
  const sorted = [...ranges].sort(byStart);
  for (const [index, range] of sorted.entries()) {
    if (range.end <= range.start) return "error_end_time_before_start_time";
    if (index > 0 && range.start < sorted[index - 1].end) return "overlapping_time_ranges";
  }
  return null;
}

/** Availability row shape shared by the DB and the scheduling engine. */
export type AvailabilityRow = { days: number[]; startTime: Date; endTime: Date; date: Date | null };

export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

// Cal stores times of day as Dates on 1970-01-01 whose UTC hours/minutes are the wall-clock time.
export function timeToDate(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes));
}

export function dateToTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export const DEFAULT_WEEKLY_HOURS: TimeRange[][] = [
  [],
  [{ start: "09:00", end: "17:00" }],
  [{ start: "09:00", end: "17:00" }],
  [{ start: "09:00", end: "17:00" }],
  [{ start: "09:00", end: "17:00" }],
  [{ start: "09:00", end: "17:00" }],
  [],
];

/** Weekly hours become one row per distinct range (shared across days); overrides one row per range. */
export function toAvailabilityRows(
  input: Pick<ScheduleInput, "weeklyHours" | "dateOverrides">
): AvailabilityRow[] {
  const daysByRange = new Map<string, number[]>();
  input.weeklyHours.forEach((ranges, day) => {
    for (const range of ranges) {
      const key = `${range.start}-${range.end}`;
      daysByRange.set(key, [...(daysByRange.get(key) ?? []), day]);
    }
  });
  const weekly = [...daysByRange].map(([key, days]) => {
    const [start, end] = key.split("-");
    return { days, startTime: timeToDate(start), endTime: timeToDate(end), date: null };
  });

  const overrides = input.dateOverrides.flatMap((override) =>
    // An all-day "unavailable" override is a zero-length range, which the engine drops.
    (override.ranges.length ? override.ranges : [{ start: "00:00", end: "00:00" }]).map((range) => ({
      days: [],
      startTime: timeToDate(range.start),
      endTime: timeToDate(range.end),
      date: dayToDate(override.date),
    }))
  );
  return [...weekly, ...overrides];
}

export function fromAvailabilityRows(
  rows: AvailabilityRow[]
): Pick<ScheduleInput, "weeklyHours" | "dateOverrides"> {
  const weeklyHours: TimeRange[][] = [[], [], [], [], [], [], []];
  const overridesByDay = new Map<string, TimeRange[]>();

  for (const row of rows) {
    const range = { start: dateToTime(row.startTime), end: dateToTime(row.endTime) };
    if (row.date) {
      const day = dateToDay(row.date);
      const ranges = overridesByDay.get(day) ?? [];
      if (range.start !== range.end) ranges.push(range);
      overridesByDay.set(day, ranges);
      continue;
    }
    for (const day of row.days) weeklyHours[day]?.push(range);
  }

  const dateOverrides: DateOverrideInput[] = [...overridesByDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ranges]) => ({ date, ranges: ranges.sort(byStart) }));
  return { weeklyHours: weeklyHours.map((ranges) => ranges.sort(byStart)), dateOverrides };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Returns a translation key describing the first problem, or null when the schedule is valid. */
export function validateSchedule(input: ScheduleInput): string | null {
  if (!isValidTimeZone(input.timeZone)) return "invalid_timezone";
  for (const [day, ranges] of input.weeklyHours.entries()) {
    const error = rangesError(ranges);
    if (error === "error_end_time_before_start_time") return `${WEEKDAY_KEYS[day]}_time_error`;
    if (error) return error;
  }
  const seen = new Set<string>();
  for (const override of input.dateOverrides) {
    if (seen.has(override.date)) return "overlapping_time_ranges";
    seen.add(override.date);
    const error = rangesError(override.ranges);
    if (error) return error;
  }
  return null;
}
