import { describe, expect, it } from "vitest";
import { busyTimesFromLimits, isIntervalLimitOrderValid, limitCheckRange } from "./limits";

const booking = (start: string, minutes = 30) => ({
  start: new Date(start),
  end: new Date(new Date(start).getTime() + minutes * 60_000),
});
const iso = (ranges: { start: Date; end: Date }[]) =>
  ranges.map((range) => [range.start.toISOString(), range.end.toISOString()]);

// Monday 2030-01-07 .. Sunday 2030-01-13 in UTC; dayjs weeks start on Sunday.
const from = new Date("2030-01-07T00:00:00Z");
const to = new Date("2030-01-12T23:59:59Z");

describe("busyTimesFromLimits", () => {
  it("blocks a day once the per-day booking count is reached", () => {
    const busy = busyTimesFromLimits({
      bookingLimits: { PER_DAY: 2 },
      from,
      to,
      eventLength: 30,
      bookings: [
        booking("2030-01-08T09:00:00Z"),
        booking("2030-01-08T15:00:00Z"),
        booking("2030-01-09T09:00:00Z"),
      ],
      timeZone: "UTC",
    });
    expect(iso(busy)).toEqual([["2030-01-08T00:00:00.000Z", "2030-01-08T23:59:59.999Z"]]);
  });

  it("blocks the whole week when the weekly count is reached, without listing its days", () => {
    const busy = busyTimesFromLimits({
      bookingLimits: { PER_DAY: 1, PER_WEEK: 2 },
      from,
      to,
      eventLength: 30,
      bookings: [booking("2030-01-07T09:00:00Z"), booking("2030-01-09T09:00:00Z")],
      timeZone: "UTC",
    });
    expect(iso(busy)).toEqual([["2030-01-06T00:00:00.000Z", "2030-01-12T23:59:59.999Z"]]);
  });

  it("blocks a day when one more booking would exceed the duration limit", () => {
    const busy = busyTimesFromLimits({
      durationLimits: { PER_DAY: 90 },
      from,
      to,
      eventLength: 30,
      bookings: [booking("2030-01-10T09:00:00Z", 60), booking("2030-01-11T09:00:00Z", 30)],
      timeZone: "UTC",
    });
    // 60 + 30 = 90 is still allowed; only a day already at 61+ minutes would overflow.
    expect(iso(busy)).toEqual([]);
    const fuller = busyTimesFromLimits({
      durationLimits: { PER_DAY: 90 },
      from,
      to,
      eventLength: 45,
      bookings: [booking("2030-01-10T09:00:00Z", 60)],
      timeZone: "UTC",
    });
    expect(iso(fuller)).toEqual([["2030-01-10T00:00:00.000Z", "2030-01-10T23:59:59.999Z"]]);
  });

  it("counts days in the host's time zone", () => {
    // 23:30 UTC on the 8th is already the 9th in Berlin.
    const busy = busyTimesFromLimits({
      bookingLimits: { PER_DAY: 1 },
      from,
      to,
      eventLength: 30,
      bookings: [booking("2030-01-08T23:30:00Z")],
      timeZone: "Europe/Berlin",
    });
    expect(iso(busy)).toEqual([["2030-01-08T23:00:00.000Z", "2030-01-09T22:59:59.999Z"]]);
  });
});

describe("limitCheckRange", () => {
  it("widens to whole periods of the largest limit", () => {
    const range = limitCheckRange(
      [{ PER_MONTH: 5 }, null],
      new Date("2030-01-10T12:00:00Z"),
      new Date("2030-01-11T12:00:00Z"),
      "UTC"
    );
    expect(range.from.toISOString()).toBe("2030-01-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2030-01-31T23:59:59.999Z");
  });
});

describe("isIntervalLimitOrderValid", () => {
  it("requires larger periods to allow at least as much", () => {
    expect(isIntervalLimitOrderValid({ PER_DAY: 2, PER_WEEK: 5 })).toBe(true);
    expect(isIntervalLimitOrderValid({ PER_DAY: 6, PER_WEEK: 5 })).toBe(false);
    expect(isIntervalLimitOrderValid({ PER_MONTH: 10 })).toBe(true);
  });
});
