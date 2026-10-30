import dayjs from "@calcom/dayjs";
import type { DateOverride, OutOfOfficeData, WorkingHours } from "./types";

export type OutOfOfficeEntry = {
  start: Date;
  end: Date;
  notes: string | null;
  showNotePublicly: boolean;
  user: { id: number; name: string | null };
  toUser: { id: number; name: string | null; username: string | null } | null;
  reason: { reason: string; emoji: string } | null;
};

/**
 * Cal's per-day view of out-of-office entries (calculateOutOfOfficeRanges): every working weekday
 * of each entry from today on, keyed YYYY-MM-DD in UTC, with notes only when shared publicly.
 */
export function outOfOfficeByDate(
  entries: OutOfOfficeEntry[],
  availability: (WorkingHours | DateOverride)[],
  now: Date = new Date()
): OutOfOfficeData {
  const workingDays = new Set(availability.flatMap((item) => ("days" in item ? item.days : [])));
  const today = dayjs(now).utc().startOf("day");
  const result: OutOfOfficeData = {};
  for (const entry of entries) {
    const entryStart = dayjs(entry.start).utc().startOf("day");
    const start = entryStart.isBefore(today) ? today : entryStart;
    const end = dayjs(entry.end).utc().endOf("day");
    for (let date = start; date.isBefore(end); date = date.add(1, "day")) {
      if (!workingDays.has(date.day())) continue;
      result[date.format("YYYY-MM-DD")] = {
        fromUser: { id: entry.user.id, displayName: entry.user.name },
        toUser: entry.toUser
          ? { id: entry.toUser.id, displayName: entry.toUser.name, username: entry.toUser.username }
          : null,
        reason: entry.reason?.reason ?? null,
        emoji: entry.reason?.emoji ?? null,
        notes: entry.showNotePublicly ? entry.notes : null,
        showNotePublicly: entry.showNotePublicly,
      };
    }
  }
  return result;
}
