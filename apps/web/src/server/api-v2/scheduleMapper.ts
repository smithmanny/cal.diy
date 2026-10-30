import { z } from "zod";
import type { ScheduleDto, ScheduleInput, TimeRange } from "../schedules/types";

const SCHEDULES_API_VERSION = "2024-06-11";

/** Cal's API names weekdays; the app's weekly hours are indexed Sunday first. */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:mm");

const availabilitySchema = z.object({
  days: z.array(z.enum(WEEKDAYS)).min(1),
  startTime: time,
  endTime: time,
});

const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  startTime: time,
  endTime: time,
});

const scheduleFields = z.object({
  name: z.string().trim().min(1).max(100),
  timeZone: z.string().min(1).max(100),
  availability: z.array(availabilitySchema).max(50),
  isDefault: z.boolean(),
  overrides: z.array(overrideSchema).max(500),
});

const createScheduleInputSchema = scheduleFields.partial({ availability: true, overrides: true });
const updateScheduleInputSchema = scheduleFields.partial();

type ScheduleApiInput = z.infer<typeof updateScheduleInputSchema>;

/** Cal's default for a schedule created without availability: weekdays, 9 to 5. */
const DEFAULT_AVAILABILITY: z.infer<typeof availabilitySchema>[] = [
  { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], startTime: "09:00", endTime: "17:00" },
];

function toWeeklyHours(availability: z.infer<typeof availabilitySchema>[]): TimeRange[][] {
  const weeklyHours: TimeRange[][] = WEEKDAYS.map(() => []);
  for (const entry of availability)
    for (const day of entry.days)
      weeklyHours[WEEKDAYS.indexOf(day)].push({ start: entry.startTime, end: entry.endTime });
  return weeklyHours;
}

/** In Cal's API a whole day off is an override from 00:00 to 00:00. */
function toDateOverrides(overrides: z.infer<typeof overrideSchema>[]): ScheduleInput["dateOverrides"] {
  const byDate = new Map<string, TimeRange[]>();
  for (const { date, startTime, endTime } of overrides) {
    const ranges = byDate.get(date) ?? [];
    if (startTime !== "00:00" || endTime !== "00:00") ranges.push({ start: startTime, end: endTime });
    byDate.set(date, ranges);
  }
  return [...byDate].map(([date, ranges]) => ({ date, ranges }));
}

/** The schedule after applying the API's changes to `current` (or Cal's defaults for a new one). */
function applyScheduleInput(current: ScheduleInput | null, input: ScheduleApiInput): ScheduleInput {
  return {
    name: input.name ?? current?.name ?? "",
    timeZone: input.timeZone ?? current?.timeZone ?? "UTC",
    weeklyHours: input.availability
      ? toWeeklyHours(input.availability)
      : (current?.weeklyHours ?? toWeeklyHours(DEFAULT_AVAILABILITY)),
    dateOverrides: input.overrides ? toDateOverrides(input.overrides) : (current?.dateOverrides ?? []),
  };
}

/** Days sharing the same hours are listed together, as Cal's API returns them. */
function toAvailability(weeklyHours: TimeRange[][]) {
  const byRange = new Map<string, { days: string[]; startTime: string; endTime: string }>();
  for (const [index, ranges] of weeklyHours.entries()) {
    for (const range of ranges) {
      const key = `${range.start}-${range.end}`;
      const entry = byRange.get(key) ?? { days: [], startTime: range.start, endTime: range.end };
      entry.days.push(WEEKDAYS[index]);
      byRange.set(key, entry);
    }
  }
  return [...byRange.values()];
}

/** Cal's ScheduleOutput_2024_06_11. */
function toScheduleOutput(schedule: ScheduleDto, ownerId: number) {
  return {
    id: schedule.id,
    ownerId,
    name: schedule.name,
    timeZone: schedule.timeZone,
    availability: toAvailability(schedule.weeklyHours),
    isDefault: schedule.isDefault,
    overrides: schedule.dateOverrides.flatMap(({ date, ranges }) =>
      ranges.length
        ? ranges.map((range) => ({ date, startTime: range.start, endTime: range.end }))
        : [{ date, startTime: "00:00", endTime: "00:00" }]
    ),
  };
}

export type { ScheduleApiInput };
export {
  SCHEDULES_API_VERSION,
  createScheduleInputSchema,
  updateScheduleInputSchema,
  applyScheduleInput,
  toScheduleOutput,
};
