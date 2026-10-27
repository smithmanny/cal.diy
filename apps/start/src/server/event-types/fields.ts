import type { JsonValue } from "@calcom/db/ids";
import type { IntervalLimit } from "@calcom/scheduling/limits";
import { type EventTypeDto, eventTypeFields, intervalLimitSchema } from "./types";

type Metadata = { [key: string]: JsonValue };

const thresholdSchema = eventTypeFields.shape.requiresConfirmationThreshold.unwrap();

// Readers for event type columns that hold enums or JSON written by Cal or older code.

export function toPeriodType(value: string | null): EventTypeDto["periodType"] {
  return value === "ROLLING" || value === "ROLLING_WINDOW" || value === "RANGE" ? value : "UNLIMITED";
}

/** Limits from older rows or other writers are ignored rather than trusted. */
export function parseIntervalLimit(value: unknown): IntervalLimit | null {
  const parsed = intervalLimitSchema.safeParse(value);
  return parsed.success && Object.values(parsed.data).some(Boolean) ? parsed.data : null;
}

/** EventType.metadata as an object; Cal keeps app settings and more in it, so writers must merge. */
export function parseMetadata(value: unknown): Metadata {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Metadata) } : {};
}

/** Sets or (for null) removes metadata keys, keeping everything else. */
export function mergeMetadata(value: unknown, changes: { [key: string]: JsonValue | null }): Metadata {
  const metadata = parseMetadata(value);
  for (const [key, changed] of Object.entries(changes)) {
    if (changed === null) delete metadata[key];
    else metadata[key] = changed;
  }
  return metadata;
}

export function parseConfirmationThreshold(metadata: unknown): EventTypeDto["requiresConfirmationThreshold"] {
  const parsed = thresholdSchema.safeParse(parseMetadata(metadata).requiresConfirmationThreshold);
  return parsed.success ? parsed.data : null;
}
