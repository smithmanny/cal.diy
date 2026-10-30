import { z } from "zod";
import { dateKeyInTimeZone } from "~/lib/date-utils";
import type { SlotsDto } from "../bookings/types";

const SLOTS_API_VERSION = "2024-09-04";

const dateOrDateTime = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.string().datetime({ offset: true }),
]);

/** Cal's GetAvailableSlotsInput_2024_09_04, by event type id or by username and slug. */
const slotsQuerySchema = z
  .object({
    start: dateOrDateTime,
    end: dateOrDateTime,
    timeZone: z.string().min(1).max(100).optional(),
    duration: z.coerce.number().int().min(1).max(1440).optional(),
    format: z.enum(["time", "range"]).default("time"),
    bookingUidToReschedule: z.string().min(1).max(100).optional(),
    eventTypeId: z.coerce.number().int().positive().optional(),
    eventTypeSlug: z.string().min(1).max(200).optional(),
    username: z.string().min(1).max(100).optional(),
  })
  .refine((query) => query.eventTypeId !== undefined || (query.eventTypeSlug && query.username), {
    message: "Provide eventTypeId, or eventTypeSlug and username",
    path: ["eventTypeId"],
  });

type SlotsApiQuery = z.infer<typeof slotsQuerySchema>;

/** A bare date means the whole day (UTC), as in Cal's API. */
function slotsRange(query: Pick<SlotsApiQuery, "start" | "end">): { from: string; to: string } {
  const from =
    query.start.length === 10 ? `${query.start}T00:00:00.000Z` : new Date(query.start).toISOString();
  const to = query.end.length === 10 ? `${query.end}T23:59:59.999Z` : new Date(query.end).toISOString();
  return { from, to };
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** Like Luxon's `toISO()`: wall-clock time in the zone with its offset, or `Z` in UTC. */
function isoInTimeZone(date: Date, timeZone: string): string {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return date.toISOString();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  const offset = Math.round((wallClock - (date.getTime() - date.getUTCMilliseconds())) / 60_000);
  const sign = offset < 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${pad(
    date.getUTCMilliseconds(),
    3
  )}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/** Cal's SlotsOutput_2024_09_04: slots grouped by day in the requested zone. */
function toSlotsOutput(
  slots: SlotsDto,
  options: { timeZone: string; format: "time" | "range"; length: number }
) {
  const output: Record<string, Record<string, string | number>[]> = {};
  for (const slot of slots.slots) {
    const start = new Date(slot);
    const day = dateKeyInTimeZone(start, options.timeZone);
    const entry: Record<string, string | number> = { start: isoInTimeZone(start, options.timeZone) };
    if (options.format === "range")
      entry.end = isoInTimeZone(new Date(start.getTime() + options.length * 60_000), options.timeZone);
    if (slots.seats) entry.attendeesCount = slots.seats.taken[slot] ?? 0;
    if (slots.seats?.bookingUids[slot]) entry.bookingUid = slots.seats.bookingUids[slot];
    output[day] ??= [];
    output[day].push(entry);
  }
  return output;
}

export type { SlotsApiQuery };
export { SLOTS_API_VERSION, slotsQuerySchema, slotsRange, isoInTimeZone, toSlotsOutput };
