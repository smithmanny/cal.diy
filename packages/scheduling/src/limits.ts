import type { Dayjs } from "@calcom/dayjs";
import dayjs from "@calcom/dayjs";

const ASCENDING_KEYS: IntervalLimitKey[] = ["PER_DAY", "PER_WEEK", "PER_MONTH", "PER_YEAR"];
const DESCENDING_KEYS = [...ASCENDING_KEYS].reverse();
const UNIT: Record<IntervalLimitKey, IntervalLimitUnit> = {
  PER_DAY: "day",
  PER_WEEK: "week",
  PER_MONTH: "month",
  PER_YEAR: "year",
};

type Period = { start: Dayjs; unit: IntervalLimitUnit };

function periodStarts(from: Dayjs, to: Dayjs, unit: IntervalLimitUnit, timeZone: string): Dayjs[] {
  const starts: Dayjs[] = [];
  const end = to.tz(timeZone).endOf(unit);
  for (let start = from.tz(timeZone).startOf(unit); start.isBefore(end); start = start.add(1, unit)) {
    starts.push(start);
  }
  return starts;
}

/** Whether a larger blocked period (or this one) already covers `start`; Cal's LimitManager check. */
function alreadyBlocked(blocked: Period[], start: Dayjs, unit: IntervalLimitUnit): boolean {
  const covers = (period: Period, at: Dayjs) =>
    !at.isBefore(period.start) && !at.isAfter(period.start.endOf(period.unit));
  const order: IntervalLimitUnit[] = ["day", "week", "month", "year"];
  return blocked.some((period) => {
    if (order.indexOf(period.unit) < order.indexOf(unit)) return false;
    // A week can straddle two months; it is only covered when both are blocked.
    if (unit === "week" && period.unit === "month") {
      return (
        covers(period, start) &&
        blocked.some((other) => other.unit === "month" && covers(other, start.endOf("week")))
      );
    }
    return covers(period, start);
  });
}

export type IntervalLimitUnit = "day" | "week" | "month" | "year";
export type IntervalLimitKey = "PER_DAY" | "PER_WEEK" | "PER_MONTH" | "PER_YEAR";
/** Cal's EventType.bookingLimits / durationLimits shape: a count or minutes per period. */
export type IntervalLimit = Partial<Record<IntervalLimitKey, number>>;

/** Cal requires per-day <= per-week <= per-month <= per-year for the limits that are set. */
export function isIntervalLimitOrderValid(limit: IntervalLimit): boolean {
  const values = ASCENDING_KEYS.flatMap((key) => (limit[key] ? [limit[key]] : []));
  return values.every((value, index) => index === 0 || values[index - 1] <= value);
}

/**
 * The range whose bookings decide the limits for slots in [from, to]: whole periods, since a
 * booking on Monday counts toward Friday's weekly limit. Unlike Cal, which queries yearly totals
 * separately, the whole year is included when a yearly limit is set.
 */
export function limitCheckRange(
  limits: (IntervalLimit | null | undefined)[],
  from: Date,
  to: Date,
  timeZone: string
): { from: Date; to: Date } {
  let start = dayjs(from).tz(timeZone);
  let end = dayjs(to).tz(timeZone);
  for (const key of ASCENDING_KEYS) {
    if (!limits.some((limit) => limit?.[key])) continue;
    start = dayjs.min(start, dayjs(from).tz(timeZone).startOf(UNIT[key]));
    end = dayjs.max(end, dayjs(to).tz(timeZone).endOf(UNIT[key]));
  }
  return { from: start.toDate(), to: end.toDate() };
}

/**
 * Cal's getBusyTimesFromLimits: whole days/weeks/months/years that are full because the event's
 * bookings reached the booking-count limit, or because one more booking of `eventLength` minutes
 * would exceed the duration limit. `bookings` are the event type's accepted bookings in
 * limitCheckRange(), and periods follow the host's time zone.
 */
export function busyTimesFromLimits({
  bookingLimits,
  durationLimits,
  from,
  to,
  eventLength,
  bookings,
  timeZone,
}: {
  bookingLimits?: IntervalLimit | null;
  durationLimits?: IntervalLimit | null;
  from: Date;
  to: Date;
  eventLength: number;
  bookings: { start: Date; end: Date }[];
  timeZone: string;
}): { start: Date; end: Date }[] {
  const blocked: Period[] = [];
  const dayOf = (date: Date) => dayjs(date).tz(timeZone).format("YYYY-MM-DD");
  const inPeriod = (booking: { start: Date }, start: Dayjs, unit: IntervalLimitUnit) => {
    // Like Cal, a booking belongs to the period its start day falls in.
    const day = dayOf(booking.start);
    return day >= start.format("YYYY-MM-DD") && day <= start.endOf(unit).format("YYYY-MM-DD");
  };

  const apply = (
    limits: IntervalLimit | null | undefined,
    isFull: (start: Dayjs, unit: IntervalLimitUnit, limit: number) => boolean
  ) => {
    if (!limits) return;
    for (const key of DESCENDING_KEYS) {
      const limit = limits[key];
      if (!limit) continue;
      const unit = UNIT[key];
      for (const start of periodStarts(dayjs(from), dayjs(to), unit, timeZone)) {
        if (alreadyBlocked(blocked, start, unit)) continue;
        if (isFull(start, unit, limit)) blocked.push({ start, unit });
      }
    }
  };

  // Counting runs first: it is cheaper, and what it blocks the duration check can skip.
  apply(
    bookingLimits,
    (start, unit, limit) => bookings.filter((booking) => inPeriod(booking, start, unit)).length >= limit
  );
  apply(durationLimits, (start, unit, limit) => {
    const booked = bookings
      .filter((booking) => inPeriod(booking, start, unit))
      .reduce((minutes, booking) => minutes + (booking.end.getTime() - booking.start.getTime()) / 60_000, 0);
    return booked + eventLength > limit;
  });

  return blocked.map((period) => ({
    start: period.start.toDate(),
    end: period.start.endOf(period.unit).toDate(),
  }));
}
