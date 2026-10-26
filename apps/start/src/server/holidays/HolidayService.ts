import "@tanstack/react-start/server-only";

import dayjs from "@calcom/dayjs";
import {
  CONFLICT_CHECK_MONTHS,
  GOOGLE_HOLIDAY_CALENDARS,
  HOLIDAY_CACHE_DAYS,
} from "@calcom/lib/holidays/constants";
import { getHolidayEmoji } from "@calcom/lib/holidays/getHolidayEmoji";
import type { DateOverride, OutOfOfficeData, WorkingHours } from "@calcom/scheduling/types";
import { AppError } from "../errors";
import type { FetchedHoliday } from "./googleHolidays";
import type { CachedHoliday, HolidayRepository } from "./HolidayRepository";

type Deps = {
  repo: HolidayRepository;
  /** Null when GOOGLE_CALENDAR_API_KEY isn't set; the feature is then hidden. */
  fetchHolidays: ((calendarId: string, year: number) => Promise<FetchedHoliday[]>) | null;
  now?: () => Date;
};

const dayKey = (date: Date) => dayjs(date).utc().format("YYYY-MM-DD");

// A year with no holidays leaves no cache rows to date the last fetch, so remember those fetches
// here; otherwise every booking page view would call Google again.
const emptyFetchedAt = new Map<string, Date>();

export type HolidayDto = { id: string; name: string; date: string; enabled: boolean };

/** Public holidays a host can take off, from Google's holiday calendars, cached per country and year. */
export class HolidayService {
  constructor(private readonly deps: Deps) {}

  isEnabled(): boolean {
    return this.deps.fetchHolidays !== null;
  }

  countries(): { code: string; name: string }[] {
    return Object.entries(GOOGLE_HOLIDAY_CALENDARS)
      .map(([code, config]) => ({ code, name: config.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async settings(userId: number): Promise<{ countryCode: string | null; holidays: HolidayDto[] }> {
    const settings = await this.deps.repo.findSettingsByUserId(userId);
    if (!settings?.countryCode) return { countryCode: null, holidays: [] };
    return {
      countryCode: settings.countryCode,
      holidays: await this.upcoming(settings.countryCode, settings.disabledIds),
    };
  }

  /** Choosing another country starts over with every holiday enabled, as in Cal. */
  async setCountry(userId: number, countryCode: string | null): Promise<void> {
    if (countryCode && !GOOGLE_HOLIDAY_CALENDARS[countryCode]) throw new AppError("not_found", 404);
    const current = await this.deps.repo.findSettingsByUserId(userId);
    const disabledIds = current?.countryCode === countryCode ? current.disabledIds : [];
    await this.deps.repo.upsertSettings(userId, { countryCode, disabledIds });
  }

  async toggle(userId: number, holidayId: string, enabled: boolean): Promise<void> {
    const settings = await this.deps.repo.findSettingsByUserId(userId);
    if (!settings?.countryCode) throw new AppError("select_country");
    const known = await this.upcoming(settings.countryCode, []);
    if (!known.some((holiday) => holiday.id === holidayId)) throw new AppError("not_found", 404);
    const disabled = new Set(settings.disabledIds);
    if (enabled) disabled.delete(holidayId);
    else disabled.add(holidayId);
    await this.deps.repo.upsertSettings(userId, {
      countryCode: settings.countryCode,
      disabledIds: [...disabled],
    });
  }

  /** Bookings the host already has on enabled holidays in the next few months (Cal warns about these). */
  async conflicts(userId: number): Promise<{ holidayName: string; date: string; bookings: number }[]> {
    const settings = await this.deps.repo.findSettingsByUserId(userId);
    if (!settings?.countryCode) return [];
    const now = this.now();
    const holidays = await this.enabledInRange(
      settings.countryCode,
      settings.disabledIds,
      now,
      dayjs(now).add(CONFLICT_CHECK_MONTHS, "month").toDate()
    );
    const days = holidays.map((holiday) => ({
      holiday,
      start: dayjs(holiday.date).utc().startOf("day").toDate(),
      end: dayjs(holiday.date).utc().endOf("day").toDate(),
    }));
    const bookings = await this.deps.repo.findHostBookingsOverlapping(userId, days);
    return days.flatMap(({ holiday, start, end }) => {
      const count = bookings.filter((b) => b.startTime < end && b.endTime > start).length;
      return count ? [{ holidayName: holiday.name, date: dayKey(holiday.date), bookings: count }] : [];
    });
  }

  /** Enabled holidays on the host's working weekdays between `from` and `to`, in Cal's OOO shape. */
  async blockedDays(
    userId: number,
    from: Date,
    to: Date,
    availability: (WorkingHours | DateOverride)[]
  ): Promise<OutOfOfficeData> {
    if (!this.isEnabled()) return {};
    const settings = await this.deps.repo.findSettingsByUserId(userId);
    if (!settings?.countryCode) return {};
    const holidays = await this.enabledInRange(
      settings.countryCode,
      settings.disabledIds,
      dayjs(from).utc().startOf("day").toDate(),
      dayjs(to).utc().endOf("day").toDate()
    );
    const workingDays = new Set(availability.flatMap((item) => ("days" in item ? item.days : [])));
    const result: OutOfOfficeData = {};
    for (const holiday of holidays) {
      if (!workingDays.has(dayjs(holiday.date).utc().day())) continue;
      result[dayKey(holiday.date)] = {
        fromUser: null,
        toUser: null,
        reason: holiday.name,
        emoji: getHolidayEmoji(holiday.name),
      };
    }
    return result;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private async upcoming(countryCode: string, disabledIds: string[]): Promise<HolidayDto[]> {
    const year = dayjs(this.now()).utc().year();
    const [thisYear, nextYear] = await Promise.all([
      this.cached(countryCode, year),
      this.cached(countryCode, year + 1),
    ]);
    const today = dayKey(this.now());
    const disabled = new Set(disabledIds);
    return [...thisYear, ...nextYear]
      .map((holiday) => ({
        id: holiday.eventId,
        name: holiday.name,
        date: dayKey(holiday.date),
        enabled: !disabled.has(holiday.eventId),
      }))
      .filter((holiday) => holiday.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async enabledInRange(countryCode: string, disabledIds: string[], from: Date, to: Date) {
    for (let year = dayjs(from).utc().year(); year <= dayjs(to).utc().year(); year++) {
      await this.refreshIfStale(countryCode, year);
    }
    const disabled = new Set(disabledIds);
    const holidays = await this.deps.repo.findCachedInRange(countryCode, from, to);
    return holidays.filter((holiday) => !disabled.has(holiday.eventId));
  }

  private async cached(countryCode: string, year: number): Promise<CachedHoliday[]> {
    await this.refreshIfStale(countryCode, year);
    return this.deps.repo.findCachedByYear(countryCode, year);
  }

  private async refreshIfStale(countryCode: string, year: number): Promise<void> {
    const calendar = GOOGLE_HOLIDAY_CALENDARS[countryCode];
    if (!calendar || !this.deps.fetchHolidays) return;
    const updatedAt =
      (await this.deps.repo.findCacheUpdatedAt(countryCode, year)) ??
      emptyFetchedAt.get(`${countryCode}:${year}`);
    if (updatedAt && dayjs(this.now()).diff(updatedAt, "day") < HOLIDAY_CACHE_DAYS) return;
    try {
      const fetched = await this.deps.fetchHolidays(calendar.calendarId, year);
      if (fetched.length) emptyFetchedAt.delete(`${countryCode}:${year}`);
      else emptyFetchedAt.set(`${countryCode}:${year}`, this.now());
      await this.deps.repo.replaceCache(
        countryCode,
        year,
        calendar.calendarId,
        fetched.map((holiday) => ({ ...holiday, year })),
        this.now()
      );
    } catch (error) {
      // A stale or empty cache is better than failing the booking page; Cal does the same.
      console.error(`Refreshing ${countryCode} holidays for ${year} failed`, error);
    }
  }
}
