import { describe, expect, it } from "vitest";
import { Frequency, recurringDates } from "./recurring";

const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe("recurringDates", () => {
  it("repeats weekly at the same local time across a DST change", () => {
    // 10:00 in New York, before and after the March 2030 switch to daylight time.
    const dates = recurringDates(new Date("2030-03-04T15:00:00Z"), "America/New_York", {
      freq: Frequency.WEEKLY,
      interval: 1,
      count: 3,
    });
    expect(iso(dates)).toEqual([
      "2030-03-04T15:00:00.000Z",
      "2030-03-11T14:00:00.000Z",
      "2030-03-18T14:00:00.000Z",
    ]);
  });

  it("honors the interval", () => {
    const dates = recurringDates(new Date("2030-01-07T09:00:00Z"), "UTC", {
      freq: Frequency.WEEKLY,
      interval: 2,
      count: 3,
    });
    expect(iso(dates)).toEqual([
      "2030-01-07T09:00:00.000Z",
      "2030-01-21T09:00:00.000Z",
      "2030-02-04T09:00:00.000Z",
    ]);
  });

  it("skips months without the start's day, like RRule", () => {
    const dates = recurringDates(new Date("2030-01-31T09:00:00Z"), "UTC", {
      freq: Frequency.MONTHLY,
      interval: 1,
      count: 3,
    });
    expect(iso(dates)).toEqual([
      "2030-01-31T09:00:00.000Z",
      "2030-03-31T09:00:00.000Z",
      "2030-05-31T09:00:00.000Z",
    ]);
  });

  it("uses the booker's calendar day, and supports daily and yearly", () => {
    // 23:30 on the 31st in Tokyo is still the 31st there even though it's the 31st 14:30 UTC.
    expect(
      iso(
        recurringDates(new Date("2030-01-31T14:30:00Z"), "Asia/Tokyo", {
          freq: Frequency.DAILY,
          interval: 1,
          count: 2,
        })
      )
    ).toEqual(["2030-01-31T14:30:00.000Z", "2030-02-01T14:30:00.000Z"]);
    expect(
      iso(
        recurringDates(new Date("2032-02-29T09:00:00Z"), "UTC", {
          freq: Frequency.YEARLY,
          interval: 1,
          count: 2,
        })
      )
    ).toEqual(["2032-02-29T09:00:00.000Z", "2036-02-29T09:00:00.000Z"]);
  });
});
