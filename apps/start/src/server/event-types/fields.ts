import type { IntervalLimit } from "@calcom/scheduling/limits";
import { type EventTypeDto, intervalLimitSchema } from "./types";

// Readers for event type columns that hold enums or JSON written by Cal or older code.

export function toPeriodType(value: string | null): EventTypeDto["periodType"] {
  return value === "ROLLING" || value === "ROLLING_WINDOW" || value === "RANGE" ? value : "UNLIMITED";
}

/** Limits from older rows or other writers are ignored rather than trusted. */
export function parseIntervalLimit(value: unknown): IntervalLimit | null {
  const parsed = intervalLimitSchema.safeParse(value);
  return parsed.success && Object.values(parsed.data).some(Boolean) ? parsed.data : null;
}
