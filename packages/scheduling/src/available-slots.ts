import type { Dayjs } from "@calcom/dayjs";
import dayjs from "@calcom/dayjs";
import { buildDateRanges, type DateRange, subtract } from "./date-ranges";
import { busyTimesFromLimits, type IntervalLimit } from "./limits";
import getSlots from "./slots";
import type { DateOverride, OutOfOfficeData, WorkingHours } from "./types";

// Cal's ROLLING_WINDOW_PERIOD_MAX_DAYS_TO_CHECK: how far ahead to look for N days with availability.
const ROLLING_WINDOW_MAX_DAYS = 30 + 31;

function dayKey(time: Date, timeZone: string): string {
  return dayjs(time).tz(timeZone).format("YYYY-MM-DD");
}

/** Last day of a ROLLING_WINDOW: the Nth day from today (booker's zone) that has any slot. */
function rollingWindowEnd(slots: Date[], event: SlotEventConfig, now: Dayjs, timeZone: string): Dayjs {
  const daysWithSlots = new Set(slots.map((slot) => dayKey(slot, timeZone)));
  let day = now.tz(timeZone).startOf("day");
  let lastCounted: Dayjs | null = null;
  let counted = 0;
  for (let checked = 0; checked < ROLLING_WINDOW_MAX_DAYS && counted < (event.periodDays ?? 0); checked++) {
    if (daysWithSlots.has(day.format("YYYY-MM-DD"))) {
      counted++;
      lastCounted = day;
    }
    day = event.periodCountCalendarDays ? day.add(1, "day") : day.businessDaysAdd(1);
  }
  return (lastCounted ?? day).endOf("day");
}

/** An interval the host is busy, with the buffers of the event that made them busy (0 for external calendars). */
export type BusyInterval = { start: Date; end: Date; beforeBuffer?: number; afterBuffer?: number };

export type SlotEventConfig = {
  length: number;
  slotInterval: number | null;
  minimumBookingNotice: number;
  beforeEventBuffer: number;
  afterEventBuffer: number;
  periodType: PeriodType;
  periodDays: number | null;
  periodCountCalendarDays: boolean;
  /** RANGE only: first and last bookable day, stored at UTC midnight like Cal. */
  periodStartDate?: Date | null;
  periodEndDate?: Date | null;
  /** Shifts every slot start by this many minutes (Cal's "offset start times"). */
  offsetStart?: number;
  onlyShowFirstAvailableSlot?: boolean;
  bookingLimits?: IntervalLimit | null;
  durationLimits?: IntervalLimit | null;
};

/**
 * UNLIMITED: any future date. ROLLING: the next N (calendar or business) days. ROLLING_WINDOW: the
 * next N days that have availability. RANGE: between two fixed dates.
 */
export type PeriodType = "UNLIMITED" | "ROLLING" | "ROLLING_WINDOW" | "RANGE";

/** A period the host works from another time zone; their weekly hours follow them there. */
export type TravelPeriod = { timeZone: string; start: Date; end: Date | null };

export type ComputeAvailableSlotsInput = {
  /** Working hours and date overrides of the schedule the event uses. */
  availability: (WorkingHours | DateOverride)[];
  /** Time zone of that schedule. */
  scheduleTimeZone: string;
  event: SlotEventConfig;
  busy: BusyInterval[];
  from: Date;
  to: Date;
  inviteeTimeZone: string;
  now?: Date;
  scheduleInterval?: number;
  travelSchedules?: TravelPeriod[];
  /** Days the host is away (see outOfOfficeByDate); they get no slots. */
  outOfOffice?: OutOfOfficeData;
  /** The event type's accepted bookings in limitCheckRange(), for booking and duration limits. */
  limitBookings?: { start: Date; end: Date }[];
};

/**
 * The range computeAvailableSlots needs busy times for: a rolling window counts available days
 * from today, so it needs today onward even when the booker is looking at a later month.
 */
export function availabilityRange(event: SlotEventConfig, from: Date, to: Date, now: Date = new Date()) {
  return { from: event.periodType === "ROLLING_WINDOW" && now < from ? now : from, to };
}

/**
 * Bookable start times between `from` and `to`, following Cal's rules: schedule hours and overrides,
 * minus busy time padded by buffers (the other event's own buffers plus this event's opposite buffer)
 * and periods already full under the event's booking and duration limits, limited by minimum
 * notice and the booking period.
 */
export function computeAvailableSlots(input: ComputeAvailableSlotsInput): Date[] {
  const { event } = input;
  const now = dayjs(input.now ?? new Date());
  let from = dayjs.max(dayjs(availabilityRange(event, input.from, input.to, now.toDate()).from), now);
  let to = dayjs(input.to);
  if (event.periodType === "ROLLING" && event.periodDays) {
    const today = now.tz(input.inviteeTimeZone);
    const last = event.periodCountCalendarDays
      ? today.add(event.periodDays, "day")
      : today.businessDaysAdd(event.periodDays);
    to = dayjs.min(to, last.endOf("day"));
  }
  if (event.periodType === "RANGE" && event.periodStartDate && event.periodEndDate) {
    // Calendar dates, read in the host's zone: Cal stores them at UTC midnight.
    const first = dayjs.tz(dayjs.utc(event.periodStartDate).format("YYYY-MM-DD"), input.scheduleTimeZone);
    const last = dayjs.tz(dayjs.utc(event.periodEndDate).format("YYYY-MM-DD"), input.scheduleTimeZone);
    from = dayjs.max(from, first.startOf("day"));
    to = dayjs.min(to, last.endOf("day"));
  }
  if (!from.isBefore(to)) return [];

  // Identical to dateRanges unless the host is out of office, in which case those days are gone.
  const { oooExcludedDateRanges: dateRanges } = buildDateRanges({
    availability: input.availability,
    timeZone: input.scheduleTimeZone,
    dateFrom: from,
    dateTo: to,
    travelSchedules: (input.travelSchedules ?? []).map((period) => ({
      timeZone: period.timeZone,
      startDate: dayjs(period.start),
      endDate: period.end ? dayjs(period.end) : undefined,
    })),
    outOfOffice: input.outOfOffice,
  });

  const busyRanges: DateRange[] = [
    ...input.busy.map((busy) => ({
      start: dayjs(busy.start).subtract((busy.beforeBuffer ?? 0) + event.afterEventBuffer, "minute"),
      end: dayjs(busy.end).add((busy.afterBuffer ?? 0) + event.beforeEventBuffer, "minute"),
    })),
    ...busyTimesFromLimits({
      bookingLimits: event.bookingLimits,
      durationLimits: event.durationLimits,
      from: from.toDate(),
      to: to.toDate(),
      eventLength: event.length,
      bookings: input.limitBookings ?? [],
      timeZone: input.scheduleTimeZone,
    }).map((range) => ({ start: dayjs(range.start), end: dayjs(range.end) })),
  ];

  const computed = getSlots({
    inviteeDate: from.tz(input.inviteeTimeZone),
    frequency: event.slotInterval ?? event.length,
    minimumBookingNotice: event.minimumBookingNotice,
    dateRanges: subtract(dateRanges, busyRanges),
    eventLength: event.length,
    offsetStart: event.offsetStart,
    scheduleInterval: input.scheduleInterval,
  });

  const fromMs = from.valueOf();
  const toMs = to.valueOf();
  let slots = computed
    .map((slot) => slot.time.toDate())
    .filter((time) => time.getTime() >= fromMs && time.getTime() + event.length * 60_000 <= toMs + 60_000)
    .sort((a, b) => a.getTime() - b.getTime());

  if (event.periodType === "ROLLING_WINDOW" && event.periodDays) {
    const windowEnd = rollingWindowEnd(slots, event, now, input.inviteeTimeZone).valueOf();
    slots = slots.filter((slot) => slot.getTime() <= windowEnd);
  }
  const requestedFrom = input.from.getTime();
  slots = slots.filter((slot) => slot.getTime() >= requestedFrom);

  if (event.onlyShowFirstAvailableSlot) {
    const seen = new Set<string>();
    slots = slots.filter((slot) => {
      const day = dayKey(slot, input.inviteeTimeZone);
      if (seen.has(day)) return false;
      seen.add(day);
      return true;
    });
  }
  return slots;
}
