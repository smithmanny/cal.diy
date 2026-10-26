import { describe, expect, it } from "vitest";
import { type OutOfOfficeEntry, outOfOfficeByDate } from "./out-of-office";
import type { WorkingHours } from "./types";

const weekdays: WorkingHours = {
  days: [1, 2, 3, 4, 5],
  startTime: new Date("1970-01-01T09:00:00Z"),
  endTime: new Date("1970-01-01T17:00:00Z"),
};

const entry = (overrides: Partial<OutOfOfficeEntry> = {}): OutOfOfficeEntry => ({
  // Friday 2030-01-04 to Monday 2030-01-07.
  start: new Date("2030-01-04T00:00:00Z"),
  end: new Date("2030-01-07T23:59:59.999Z"),
  notes: "Back on Tuesday",
  showNotePublicly: false,
  user: { id: 1, name: "Hana" },
  toUser: null,
  reason: { reason: "ooo_reasons_vacation", emoji: "🏝️" },
  ...overrides,
});

describe("outOfOfficeByDate", () => {
  it("covers each working day of the entry and skips the weekend", () => {
    const days = outOfOfficeByDate([entry()], [weekdays], new Date("2030-01-01T00:00:00Z"));
    expect(Object.keys(days)).toEqual(["2030-01-04", "2030-01-07"]);
    expect(days["2030-01-04"]).toMatchObject({
      fromUser: { id: 1, displayName: "Hana" },
      reason: "ooo_reasons_vacation",
      emoji: "🏝️",
    });
  });

  it("only shares notes the host made public", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    expect(outOfOfficeByDate([entry()], [weekdays], now)["2030-01-04"].notes).toBeNull();
    expect(
      outOfOfficeByDate([entry({ showNotePublicly: true })], [weekdays], now)["2030-01-04"].notes
    ).toBe("Back on Tuesday");
  });

  it("starts from today for entries that already began, and carries the redirect", () => {
    const days = outOfOfficeByDate(
      [entry({ toUser: { id: 2, name: "Greta", username: "greta" } })],
      [weekdays],
      new Date("2030-01-07T10:00:00Z")
    );
    expect(Object.keys(days)).toEqual(["2030-01-07"]);
    expect(days["2030-01-07"].toUser).toEqual({ id: 2, displayName: "Greta", username: "greta" });
  });
});
