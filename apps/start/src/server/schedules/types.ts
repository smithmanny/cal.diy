import { z } from "zod";

/** Wall-clock time of day, "HH:mm" (24h). "23:59" stands for end of day, as in Cal. */
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const timeRangeSchema = z.object({ start: timeOfDay, end: timeOfDay });

export const dateOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Empty means unavailable all day. */
  ranges: z.array(timeRangeSchema),
});

export const scheduleInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  timeZone: z.string().min(1),
  /** Seven entries, Sunday first, matching Date.getDay(). */
  weeklyHours: z.array(z.array(timeRangeSchema)).length(7),
  dateOverrides: z.array(dateOverrideSchema),
});

export type TimeRange = z.infer<typeof timeRangeSchema>;
export type DateOverrideInput = z.infer<typeof dateOverrideSchema>;
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export type ScheduleDto = ScheduleInput & { id: number; isDefault: boolean };

export type ScheduleSummaryDto = {
  id: number;
  name: string;
  timeZone: string;
  isDefault: boolean;
  weeklyHours: TimeRange[][];
};
