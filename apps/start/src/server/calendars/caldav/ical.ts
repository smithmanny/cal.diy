import type { BusyInterval } from "@calcom/scheduling/available-slots";
import type { CalendarEventInput } from "../types";

type Property = { name: string; params: Record<string, string>; value: string };

function unfold(ics: string): string[] {
  return ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function parseProperty(line: string): Property | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...params] = line.slice(0, colon).split(";");
  return {
    name: name.toUpperCase(),
    params: Object.fromEntries(
      params.map((param) => {
        const [key, value = ""] = param.split("=");
        return [key.toUpperCase(), value.replace(/^"|"$/g, "")];
      })
    ),
    value: line.slice(colon + 1),
  };
}

/** The offset of `timeZone` from UTC at `date`, in milliseconds. */
function zoneOffset(date: number, timeZone: string): number {
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
      .formatToParts(new Date(date))
      .map((part) => [part.type, Number(part.value)])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date / 1000) * 1000;
}

/** Wall-clock time in `timeZone` to an instant; unknown zones (e.g. Windows names) count as UTC. */
function zonedToUtc(wallClock: number, timeZone: string | undefined): Date {
  if (!timeZone) return new Date(wallClock);
  try {
    const first = wallClock - zoneOffset(wallClock, timeZone);
    return new Date(wallClock - zoneOffset(first, timeZone));
  } catch {
    return new Date(wallClock);
  }
}

function eventBlocks(ics: string): Property[][] {
  const events: Property[][] = [];
  let current: Property[] | null = null;
  for (const line of unfold(ics)) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const property = parseProperty(line);
      if (property) current.push(property);
    }
  }
  return events;
}

function busyFromEvent(properties: Property[]): BusyInterval | null {
  const get = (name: string) => properties.find((property) => property.name === name);
  if (get("TRANSP")?.value === "TRANSPARENT" || get("STATUS")?.value === "CANCELLED") return null;
  const startProperty = get("DTSTART");
  const start = startProperty && parseIcsDate(startProperty);
  if (!start) return null;
  const endProperty = get("DTEND");
  const end = endProperty && parseIcsDate(endProperty);
  if (end) return { start: start.date, end: end.date };
  const duration = parseDuration(get("DURATION")?.value ?? "");
  // RFC 5545: without DTEND or DURATION, an all-day event lasts a day and a timed one is instant.
  const length = duration ?? (start.allDay ? 86_400_000 : 0);
  return { start: start.date, end: new Date(start.date.getTime() + length) };
}

function stamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function escapeParam(text: string): string {
  return `"${text.replace(/"/g, "'")}"`;
}

function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push((i ? " " : "") + line.slice(i, i + 74));
  return parts.join("\r\n");
}

/** DATE or DATE-TIME (UTC, floating or with TZID); all-day dates start at midnight UTC. */
export function parseIcsDate(property: Property): { date: Date; allDay: boolean } | null {
  const match = property.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zulu] = match;
  const wallClock = Date.UTC(+year, +month - 1, +day, +(hour ?? 0), +(minute ?? 0), +(second ?? 0));
  if (!hour) return { date: new Date(wallClock), allDay: true };
  return { date: zulu ? new Date(wallClock) : zonedToUtc(wallClock, property.params.TZID), allDay: false };
}

/** An ISO 8601 duration (P1DT2H30M) in milliseconds. */
export function parseDuration(value: string): number | null {
  const match = value.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const [, sign, weeks, days, hours, minutes, seconds] = match.map((part) => part ?? "0");
  const ms = ((((+weeks * 7 + +days) * 24 + +hours) * 60 + +minutes) * 60 + +seconds) * 1000;
  return sign === "-" ? -ms : ms;
}

/** Busy intervals from calendar objects (VEVENTs that are opaque and not cancelled). */
export function busyFromIcs(ics: string): BusyInterval[] {
  return eventBlocks(ics)
    .map(busyFromEvent)
    .filter((busy): busy is BusyInterval => busy !== null && busy.end > busy.start);
}

/**
 * A calendar object resource for CalDAV PUT (no METHOD, per RFC 4791). Attendees are marked
 * SCHEDULE-AGENT=CLIENT so servers like iCloud don't email invites; Cal sends its own emails.
 */
export function buildCalendarObject(event: CalendarEventInput, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cal.diy//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    `ORGANIZER;CN=${escapeParam(event.organizer.name ?? event.organizer.email)}:mailto:${event.organizer.email}`,
    ...event.attendees.map(
      (attendee) =>
        `ATTENDEE;CN=${escapeParam(attendee.displayName ?? attendee.email)};PARTSTAT=NEEDS-ACTION;SCHEDULE-AGENT=CLIENT:mailto:${attendee.email}`
    ),
    ...(event.private ? ["CLASS:PRIVATE"] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
