import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeAvailableSlots, type SlotEventConfig } from "./available-slots";
import type { WorkingHours } from "./types";

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const weekdays9to5: WorkingHours = {
  days: [1, 2, 3, 4, 5],
  startTime: time("09:00"),
  endTime: time("17:00"),
};

const event: SlotEventConfig = {
  length: 60,
  slotInterval: null,
  minimumBookingNotice: 0,
  beforeEventBuffer: 0,
  afterEventBuffer: 0,
  periodType: "UNLIMITED",
  periodDays: null,
  periodCountCalendarDays: true,
};

// Monday 2026-11-02, 06:00 UTC.
const NOW = new Date("2026-11-02T06:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

describe("computeAvailableSlots", () => {
  it("offers hourly slots within working hours in the schedule's time zone", () => {
    const slots = computeAvailableSlots({
      availability: [weekdays9to5],
      scheduleTimeZone: "America/New_York",
      event,
      busy: [],
      from: new Date("2026-11-02T00:00:00Z"),
      to: new Date("2026-11-03T00:00:00Z"),
      inviteeTimeZone: "America/New_York",
      now: NOW,
    });
    // 9:00-17:00 EST = 14:00-22:00 UTC
    expect(iso(slots)).toEqual([
      "2026-11-02T14:00:00.000Z",
      "2026-11-02T15:00:00.000Z",
      "2026-11-02T16:00:00.000Z",
      "2026-11-02T17:00:00.000Z",
      "2026-11-02T18:00:00.000Z",
      "2026-11-02T19:00:00.000Z",
      "2026-11-02T20:00:00.000Z",
      "2026-11-02T21:00:00.000Z",
    ]);
  });

  it("removes busy time padded by both events' buffers", () => {
    const slots = computeAvailableSlots({
      availability: [weekdays9to5],
      scheduleTimeZone: "UTC",
      event: { ...event, length: 30, beforeEventBuffer: 15 },
      // 11:00-12:00 booking whose event has a 15 min after-buffer => busy until 12:15, plus our 15 min before-buffer => 12:30
      busy: [
        { start: new Date("2026-11-02T11:00:00Z"), end: new Date("2026-11-02T12:00:00Z"), afterBuffer: 15 },
      ],
      from: new Date("2026-11-02T10:00:00Z"),
      to: new Date("2026-11-02T13:30:00Z"),
      inviteeTimeZone: "UTC",
      now: NOW,
    });
    expect(iso(slots)).toEqual([
      "2026-11-02T10:00:00.000Z",
      "2026-11-02T10:30:00.000Z",
      "2026-11-02T12:30:00.000Z",
      "2026-11-02T13:00:00.000Z",
    ]);
  });

  it("respects minimum notice", () => {
    const slots = computeAvailableSlots({
      availability: [weekdays9to5],
      scheduleTimeZone: "UTC",
      event: { ...event, minimumBookingNotice: 6 * 60 },
      busy: [],
      from: new Date("2026-11-02T00:00:00Z"),
      to: new Date("2026-11-02T23:59:00Z"),
      inviteeTimeZone: "UTC",
      now: NOW,
    });
    // now 06:00 + 6h notice => first slot 12:00
    expect(iso(slots)[0]).toBe("2026-11-02T12:00:00.000Z");
  });

  it("stops at the end of a rolling window counted in business days", () => {
    const slots = computeAvailableSlots({
      availability: [{ ...weekdays9to5, days: [0, 1, 2, 3, 4, 5, 6] }],
      scheduleTimeZone: "UTC",
      event: { ...event, periodType: "ROLLING", periodDays: 5, periodCountCalendarDays: false },
      busy: [],
      from: new Date("2026-11-02T00:00:00Z"),
      to: new Date("2026-11-20T00:00:00Z"),
      inviteeTimeZone: "UTC",
      now: NOW,
    });
    // Monday + 5 business days = next Monday (Nov 9)
    expect(slots.at(-1)?.toISOString().slice(0, 10)).toBe("2026-11-09");
  });

  it("returns nothing for a window entirely in the past", () => {
    expect(
      computeAvailableSlots({
        availability: [weekdays9to5],
        scheduleTimeZone: "UTC",
        event,
        busy: [],
        from: new Date("2026-10-01T00:00:00Z"),
        to: new Date("2026-10-02T00:00:00Z"),
        inviteeTimeZone: "UTC",
        now: NOW,
      })
    ).toEqual([]);
  });

  it("honors an all-day unavailable date override", () => {
    const slots = computeAvailableSlots({
      availability: [
        weekdays9to5,
        { date: new Date("2026-11-03T00:00:00Z"), startTime: time("00:00"), endTime: time("00:00") },
      ],
      scheduleTimeZone: "UTC",
      event,
      busy: [],
      from: new Date("2026-11-02T00:00:00Z"),
      to: new Date("2026-11-04T23:59:00Z"),
      inviteeTimeZone: "UTC",
      now: NOW,
    });
    const days = new Set(slots.map((s) => s.toISOString().slice(0, 10)));
    expect([...days]).toEqual(["2026-11-02", "2026-11-04"]);
  });
});
