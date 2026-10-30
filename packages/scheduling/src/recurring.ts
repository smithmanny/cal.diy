import dayjs from "@calcom/dayjs";

/** RRule's frequency numbers, which Cal stores in EventType.recurringEvent. */
const Frequency = { YEARLY: 0, MONTHLY: 1, WEEKLY: 2, DAILY: 3 } as const;

type RecurringFrequency = (typeof Frequency)[keyof typeof Frequency];

type RecurringRule = { freq: RecurringFrequency; interval: number; count: number };

const UNITS = {
  [Frequency.YEARLY]: "year",
  [Frequency.MONTHLY]: "month",
  [Frequency.WEEKLY]: "week",
  [Frequency.DAILY]: "day",
} as const;

// Months or years without the start's day (31st, 29 Feb) are skipped, so look a little further.
const MAX_STEPS_PER_OCCURRENCE = 12;

/**
 * Start times of a recurring booking, like Cal's parseRecurringDates with RRule: every `interval`
 * units from `start`, keeping the booker's wall-clock time across DST, and skipping months or years
 * that lack the start's day (as RRule does), until `count` occurrences.
 */
function recurringDates(start: Date, timeZone: string, rule: RecurringRule): Date[] {
  const first = dayjs(start).tz(timeZone);
  const unit = UNITS[rule.freq];
  const dates: Date[] = [];
  const maxSteps = rule.count * MAX_STEPS_PER_OCCURRENCE;
  const skipsShortPeriods = rule.freq === Frequency.MONTHLY || rule.freq === Frequency.YEARLY;
  for (let step = 0; dates.length < rule.count && step <= maxSteps; step++) {
    const local = first.add(step * rule.interval, unit);
    if (skipsShortPeriods && local.date() !== first.date()) continue;
    // Rebuild from the wall-clock time so a DST change in between doesn't shift the hour.
    const wallClock = dayjs.tz(local.format("YYYY-MM-DDTHH:mm:ss"), timeZone);
    dates.push(wallClock.toDate());
  }
  return dates;
}

export type { RecurringFrequency, RecurringRule };
export { Frequency, recurringDates };
