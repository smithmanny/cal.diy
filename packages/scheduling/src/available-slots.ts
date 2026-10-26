import type { Dayjs } from "@calcom/dayjs";
import dayjs from "@calcom/dayjs";
import { buildDateRanges, type DateRange, subtract } from "./date-ranges";
import getSlots from "./slots";
import type { DateOverride, OutOfOfficeData, WorkingHours } from "./types";

function rollingWindowEnd(event: SlotEventConfig, now: Dayjs, timeZone: string): Dayjs | null {
  if (event.periodType !== "ROLLING" || !event.periodDays) return null;
  const today = now.tz(timeZone);
  const last = event.periodCountCalendarDays
    ? today.add(event.periodDays, "day")
    : today.businessDaysAdd(event.periodDays);
  return last.endOf("day");
}

/** An interval the host is busy, with the buffers of the event that made them busy (0 for external calendars). */
export type BusyInterval = { start: Date; end: Date; beforeBuffer?: number; afterBuffer?: number };

export type SlotEventConfig = {
  length: number;
  slotInterval: number | null;
  minimumBookingNotice: number;
  beforeEventBuffer: number;
  afterEventBuffer: number;
  periodType: "UNLIMITED" | "ROLLING";
  periodDays: number | null;
  periodCountCalendarDays: boolean;
};

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
};

/**
 * Bookable start times between `from` and `to`, following Cal's rules: schedule hours and overrides,
 * minus busy time padded by buffers (the other event's own buffers plus this event's opposite buffer),
 * limited by minimum notice and the rolling booking window.
 */
export function computeAvailableSlots(input: ComputeAvailableSlotsInput): Date[] {
  const now = dayjs(input.now ?? new Date());
  const from = dayjs.max(dayjs(input.from), now);
  const windowEnd = rollingWindowEnd(input.event, now, input.scheduleTimeZone);
  const to = windowEnd ? dayjs.min(dayjs(input.to), windowEnd) : dayjs(input.to);
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

  const busyRanges: DateRange[] = input.busy.map((busy) => ({
    start: dayjs(busy.start).subtract((busy.beforeBuffer ?? 0) + input.event.afterEventBuffer, "minute"),
    end: dayjs(busy.end).add((busy.afterBuffer ?? 0) + input.event.beforeEventBuffer, "minute"),
  }));

  const slots = getSlots({
    inviteeDate: from.tz(input.inviteeTimeZone),
    frequency: input.event.slotInterval ?? input.event.length,
    minimumBookingNotice: input.event.minimumBookingNotice,
    dateRanges: subtract(dateRanges, busyRanges),
    eventLength: input.event.length,
    scheduleInterval: input.scheduleInterval,
  });

  const fromMs = from.valueOf();
  const toMs = to.valueOf();
  return slots
    .map((slot) => slot.time.toDate())
    .filter(
      (time) => time.getTime() >= fromMs && time.getTime() + input.event.length * 60_000 <= toMs + 60_000
    )
    .sort((a, b) => a.getTime() - b.getTime());
}
