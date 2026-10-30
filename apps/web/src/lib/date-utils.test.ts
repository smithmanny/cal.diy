import { describe, expect, it } from "vitest";
import {
  addUtcMonths,
  dateKeyInTimeZone,
  daysBetween,
  monthGrid,
  monthRangeInTimeZone,
  utcDateKey,
  utcEndOfDay,
  utcStartOfDay,
} from "./date-utils";

describe("date-utils", () => {
  it("keys an instant by its local date", () => {
    expect(dateKeyInTimeZone("2030-01-07T23:30:00Z", "UTC")).toBe("2030-01-07");
    expect(dateKeyInTimeZone("2030-01-07T23:30:00Z", "Asia/Tokyo")).toBe("2030-01-08");
    expect(dateKeyInTimeZone("2030-01-07T03:00:00Z", "America/Los_Angeles")).toBe("2030-01-06");
  });

  it("finds month boundaries in a time zone, across DST", () => {
    const { from, to } = monthRangeInTimeZone(2030, 3, "America/New_York");
    expect(from.toISOString()).toBe("2030-03-01T05:00:00.000Z");
    expect(to.toISOString()).toBe("2030-04-01T04:00:00.000Z");
  });

  it("lays out a month in Sunday-first weeks", () => {
    const grid = monthGrid(2030, 9); // Sept 2030 starts on a Sunday
    expect(grid[0][0]).toBe("2030-09-01");
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("does UTC day arithmetic natively", () => {
    const instant = new Date("2024-03-10T22:15:00.000Z");
    expect(utcDateKey(instant)).toBe("2024-03-10");
    expect(utcStartOfDay("2024-03-10").toISOString()).toBe("2024-03-10T00:00:00.000Z");
    expect(utcStartOfDay(instant).toISOString()).toBe("2024-03-10T00:00:00.000Z");
    expect(utcEndOfDay(instant).toISOString()).toBe("2024-03-10T23:59:59.999Z");
    expect(daysBetween(new Date("2024-03-01T12:00:00Z"), instant)).toBe(9);
    expect(addUtcMonths(new Date("2024-01-31T09:00:00Z"), 1).toISOString()).toBe("2024-02-29T09:00:00.000Z");
    expect(addUtcMonths(new Date("2023-11-15T09:00:00Z"), 3).toISOString()).toBe("2024-02-15T09:00:00.000Z");
  });
});
