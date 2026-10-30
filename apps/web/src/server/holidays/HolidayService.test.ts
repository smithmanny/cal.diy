import type { Database } from "@calcom/db/database";
import { booking, user } from "@calcom/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { createGoogleHolidayFetcher } from "./googleHolidays";
import { HolidayRepository } from "./HolidayRepository";
import { HolidayService } from "./HolidayService";

const weekdays = [
  {
    days: [1, 2, 3, 4, 5],
    startTime: new Date("1970-01-01T09:00:00Z"),
    endTime: new Date("1970-01-01T17:00:00Z"),
  },
];

let db: Database;
let userId: number;
let fetches: number;
let service: HolidayService;

// Wednesday 2030-12-25 (Christmas) and Saturday 2030-12-28.
const HOLIDAYS = [
  { id: "xmas", summary: "Christmas Day", start: { date: "2030-12-25" } },
  { id: "sat", summary: "Saturday Holiday", start: { date: "2030-12-28" } },
];

beforeEach(async () => {
  db = await createTestDb();
  fetches = 0;
  [{ id: userId }] = await db
    .insert(user)
    .values({ email: "h@example.com", username: "h" })
    .returning({ id: user.id });
  const fakeGoogle = async (url: URL | RequestInfo) => {
    fetches++;
    const year = new URL(String(url)).searchParams.get("timeMin")?.slice(0, 4);
    return Response.json({ items: year === "2030" ? HOLIDAYS : [] });
  };
  service = new HolidayService({
    repo: new HolidayRepository(db),
    fetchHolidays: createGoogleHolidayFetcher({
      apiBase: "https://google.test",
      apiKey: "k",
      fetchImpl: fakeGoogle as typeof fetch,
    }),
    now: () => new Date("2030-12-01T00:00:00Z"),
  });
});

describe("HolidayService", () => {
  it("lists upcoming holidays for the chosen country, enabled by default", async () => {
    await service.setCountry(userId, "GB");
    const { countryCode, holidays } = await service.settings(userId);
    expect(countryCode).toBe("GB");
    expect(holidays).toEqual([
      { id: "xmas", name: "Christmas Day", date: "2030-12-25", enabled: true },
      { id: "sat", name: "Saturday Holiday", date: "2030-12-28", enabled: true },
    ]);
  });

  it("blocks enabled holidays on working days, with Cal's emoji", async () => {
    await service.setCountry(userId, "GB");
    const days = await service.blockedDays(
      userId,
      new Date("2030-12-20T00:00:00Z"),
      new Date("2030-12-31T00:00:00Z"),
      weekdays
    );
    expect(days).toEqual({
      "2030-12-25": { fromUser: null, toUser: null, reason: "Christmas Day", emoji: "🎄" },
    });

    await service.toggle(userId, "xmas", false);
    expect(
      await service.blockedDays(
        userId,
        new Date("2030-12-20T00:00:00Z"),
        new Date("2030-12-31T00:00:00Z"),
        weekdays
      )
    ).toEqual({});
  });

  it("caches Google's answer instead of asking on every lookup", async () => {
    await service.setCountry(userId, "GB");
    await service.settings(userId);
    const afterFirst = fetches;
    await service.settings(userId);
    await service.blockedDays(
      userId,
      new Date("2030-12-20T00:00:00Z"),
      new Date("2030-12-31T00:00:00Z"),
      weekdays
    );
    expect(fetches).toBe(afterFirst);
  });

  it("counts bookings already on enabled holidays", async () => {
    await service.setCountry(userId, "GB");
    await db.insert(booking).values({
      uid: "b1",
      userId,
      title: "Xmas call",
      startTime: new Date("2030-12-25T10:00:00Z"),
      endTime: new Date("2030-12-25T11:00:00Z"),
      status: "ACCEPTED",
    });
    expect(await service.conflicts(userId)).toEqual([
      { holidayName: "Christmas Day", date: "2030-12-25", bookings: 1 },
    ]);
  });

  it("rejects unknown countries and starts over when the country changes", async () => {
    await expect(service.setCountry(userId, "XX")).rejects.toMatchObject({ code: "not_found" });
    await service.setCountry(userId, "GB");
    await service.toggle(userId, "xmas", false);
    await service.setCountry(userId, "US");
    await service.setCountry(userId, "GB");
    expect((await service.settings(userId)).holidays.every((holiday) => holiday.enabled)).toBe(true);
  });
});
