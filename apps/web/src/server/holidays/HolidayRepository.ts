import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { chunkRowsForInsert } from "@calcom/db/insert-chunks";
import { booking, holidayCache, userHolidaySettings } from "@calcom/db/schema";
import { and, asc, eq, gt, gte, inArray, lt, lte, or } from "drizzle-orm";

export type CachedHoliday = { eventId: string; name: string; date: Date; year: number };

export class HolidayRepository {
  constructor(private readonly db: Database) {}

  async findSettingsByUserId(userId: number) {
    const [found] = await this.db
      .select({ countryCode: userHolidaySettings.countryCode, disabledIds: userHolidaySettings.disabledIds })
      .from(userHolidaySettings)
      .where(eq(userHolidaySettings.userId, userId))
      .limit(1);
    return found ?? null;
  }

  async upsertSettings(
    userId: number,
    data: { countryCode: string | null; disabledIds: string[] }
  ): Promise<void> {
    await this.db
      .insert(userHolidaySettings)
      .values({ userId, ...data })
      .onConflictDoUpdate({ target: userHolidaySettings.userId, set: data });
  }

  /** When the cache for a country and year was last refreshed, or null if never. */
  async findCacheUpdatedAt(countryCode: string, year: number): Promise<Date | null> {
    const [found] = await this.db
      .select({ updatedAt: holidayCache.updatedAt })
      .from(holidayCache)
      .where(and(eq(holidayCache.countryCode, countryCode), eq(holidayCache.year, year)))
      .limit(1);
    return found?.updatedAt ?? null;
  }

  /** Swaps a country's holidays for one year in a single batch, so readers never see it half-written. */
  async replaceCache(
    countryCode: string,
    year: number,
    calendarId: string,
    holidays: CachedHoliday[],
    fetchedAt: Date
  ) {
    const remove = this.db
      .delete(holidayCache)
      .where(and(eq(holidayCache.countryCode, countryCode), eq(holidayCache.year, year)));
    if (!holidays.length) {
      await remove;
      return;
    }
    const rows = holidays.map((holiday) => ({
      ...holiday,
      countryCode,
      calendarId,
      createdAt: fetchedAt,
      updatedAt: fetchedAt,
    }));
    const inserts = chunkRowsForInsert(holidayCache, rows).map((chunk) =>
      this.db.insert(holidayCache).values(chunk).onConflictDoNothing()
    );
    await this.db.batch([remove, ...inserts]);
  }

  findCachedByYear(countryCode: string, year: number): Promise<CachedHoliday[]> {
    return this.db
      .select({
        eventId: holidayCache.eventId,
        name: holidayCache.name,
        date: holidayCache.date,
        year: holidayCache.year,
      })
      .from(holidayCache)
      .where(and(eq(holidayCache.countryCode, countryCode), eq(holidayCache.year, year)))
      .orderBy(asc(holidayCache.date));
  }

  findCachedInRange(countryCode: string, from: Date, to: Date): Promise<CachedHoliday[]> {
    return this.db
      .select({
        eventId: holidayCache.eventId,
        name: holidayCache.name,
        date: holidayCache.date,
        year: holidayCache.year,
      })
      .from(holidayCache)
      .where(
        and(
          eq(holidayCache.countryCode, countryCode),
          gte(holidayCache.date, from),
          lte(holidayCache.date, to)
        )
      )
      .orderBy(asc(holidayCache.date));
  }

  /** The host's live bookings overlapping any of the given UTC days. */
  findHostBookingsOverlapping(userId: number, days: { start: Date; end: Date }[]) {
    if (!days.length) return Promise.resolve([]);
    return this.db
      .select({
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
      })
      .from(booking)
      .where(
        and(
          eq(booking.userId, userId),
          inArray(booking.status, ["ACCEPTED", "PENDING"]),
          or(...days.map((day) => and(lt(booking.startTime, day.end), gt(booking.endTime, day.start))))
        )
      );
  }
}
