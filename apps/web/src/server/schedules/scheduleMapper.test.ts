import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_HOURS,
  dateToTime,
  fromAvailabilityRows,
  timeToDate,
  toAvailabilityRows,
  validateSchedule,
} from "./scheduleMapper";
import type { ScheduleInput } from "./types";

const base: ScheduleInput = {
  name: "Work",
  timeZone: "Europe/Berlin",
  weeklyHours: DEFAULT_WEEKLY_HOURS,
  dateOverrides: [],
};

describe("time conversion", () => {
  it("stores wall-clock times as UTC hours on 1970-01-01, like Cal", () => {
    expect(timeToDate("09:30").toISOString()).toBe("1970-01-01T09:30:00.000Z");
    expect(dateToTime(new Date("1970-01-01T23:59:00.000Z"))).toBe("23:59");
  });
});

describe("toAvailabilityRows / fromAvailabilityRows", () => {
  it("collapses identical ranges across weekdays into one row", () => {
    const rows = toAvailabilityRows(base);
    expect(rows).toEqual([
      { days: [1, 2, 3, 4, 5], startTime: timeToDate("09:00"), endTime: timeToDate("17:00"), date: null },
    ]);
  });

  it("round-trips split days and overrides, including all-day unavailable", () => {
    const input: ScheduleInput = {
      ...base,
      weeklyHours: [
        [],
        [
          { start: "13:00", end: "17:00" },
          { start: "09:00", end: "12:00" },
        ],
        [{ start: "09:00", end: "12:00" }],
        [],
        [],
        [],
        [{ start: "10:00", end: "14:00" }],
      ],
      dateOverrides: [
        { date: "2026-12-25", ranges: [] },
        { date: "2026-12-24", ranges: [{ start: "09:00", end: "12:00" }] },
      ],
    };

    expect(fromAvailabilityRows(toAvailabilityRows(input))).toEqual({
      weeklyHours: [
        [],
        [
          { start: "09:00", end: "12:00" },
          { start: "13:00", end: "17:00" },
        ],
        [{ start: "09:00", end: "12:00" }],
        [],
        [],
        [],
        [{ start: "10:00", end: "14:00" }],
      ],
      dateOverrides: [
        { date: "2026-12-24", ranges: [{ start: "09:00", end: "12:00" }] },
        { date: "2026-12-25", ranges: [] },
      ],
    });
  });

  it("encodes an unavailable day as a zero-length range on that date", () => {
    const [row] = toAvailabilityRows({
      weeklyHours: [[], [], [], [], [], [], []],
      dateOverrides: [{ date: "2026-12-25", ranges: [] }],
    });
    expect(row).toEqual({
      days: [],
      startTime: timeToDate("00:00"),
      endTime: timeToDate("00:00"),
      date: new Date("2026-12-25T00:00:00.000Z"),
    });
  });
});

describe("validateSchedule", () => {
  it("accepts the default schedule", () => {
    expect(validateSchedule(base)).toBeNull();
  });

  it("rejects unknown time zones", () => {
    expect(validateSchedule({ ...base, timeZone: "Mars/Olympus" })).toBe("invalid_timezone");
  });

  it("names the weekday whose range ends before it starts", () => {
    const weeklyHours = [...DEFAULT_WEEKLY_HOURS];
    weeklyHours[3] = [{ start: "17:00", end: "09:00" }];
    expect(validateSchedule({ ...base, weeklyHours })).toBe("wednesday_time_error");
  });

  it("rejects overlapping ranges on a day and duplicate override dates", () => {
    const weeklyHours = [...DEFAULT_WEEKLY_HOURS];
    weeklyHours[1] = [
      { start: "09:00", end: "12:00" },
      { start: "11:00", end: "13:00" },
    ];
    expect(validateSchedule({ ...base, weeklyHours })).toBe("overlapping_time_ranges");
    expect(
      validateSchedule({
        ...base,
        dateOverrides: [
          { date: "2026-12-24", ranges: [] },
          { date: "2026-12-24", ranges: [] },
        ],
      })
    ).toBe("overlapping_time_ranges");
  });

  it("allows back-to-back ranges", () => {
    const weeklyHours = [...DEFAULT_WEEKLY_HOURS];
    weeklyHours[1] = [
      { start: "09:00", end: "12:00" },
      { start: "12:00", end: "13:00" },
    ];
    expect(validateSchedule({ ...base, weeklyHours })).toBeNull();
  });
});
