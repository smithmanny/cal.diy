import { availability, booking, eventType, user } from "@calcom/db/schema";
import { describe, expect, it } from "vitest";
import { convertRow, enumName, parsePostgresDate } from "./convert";

describe("parsePostgresDate", () => {
  it("reads Prisma's zoneless timestamps as UTC", () => {
    expect(parsePostgresDate("2024-06-01T10:00:00.123").toISOString()).toBe("2024-06-01T10:00:00.123Z");
  });

  it("keeps an explicit offset", () => {
    expect(parsePostgresDate("2024-06-01T10:00:00+02:00").toISOString()).toBe("2024-06-01T08:00:00.000Z");
  });

  it("puts dates at UTC midnight and times of day on 1970-01-01", () => {
    expect(parsePostgresDate("2024-12-24").toISOString()).toBe("2024-12-24T00:00:00.000Z");
    expect(parsePostgresDate("17:30:00").toISOString()).toBe("1970-01-01T17:30:00.000Z");
  });

  it("refuses text that isn't a date", () => {
    expect(() => parsePostgresDate("soon")).toThrow('Unreadable date "soon"');
  });
});

describe("enumName", () => {
  it("maps @map values back to Prisma's names", () => {
    expect(enumName("roundRobin", ["ROUND_ROBIN", "COLLECTIVE"])).toBe("ROUND_ROBIN");
    expect(enumName("rolling_window", ["ROLLING", "ROLLING_WINDOW"])).toBe("ROLLING_WINDOW");
    expect(enumName("user-event-type", ["UserEventType", "User"])).toBe("UserEventType");
    expect(enumName("ADMIN", ["USER", "ADMIN"])).toBe("ADMIN");
  });

  it("refuses values outside the enum", () => {
    expect(() => enumName("weekly", ["DAY", "HOUR"])).toThrow('"weekly" is not one of DAY, HOUR');
  });
});

describe("convertRow", () => {
  it("converts by column type and drops columns the new schema doesn't have", () => {
    const row = convertRow(booking, {
      id: 7,
      uid: "uid-7",
      title: "Call",
      startTime: "2024-06-01T10:00:00",
      endTime: "2024-06-01T10:30:00",
      status: "accepted",
      responses: { name: "Bob" },
      paid: false,
      someRemovedColumn: "x",
    });
    expect(row).toMatchObject({
      id: 7,
      startTime: new Date("2024-06-01T10:00:00Z"),
      status: "ACCEPTED",
      responses: { name: "Bob" },
      paid: false,
    });
    expect(row).not.toHaveProperty("someRemovedColumn");
  });

  it("turns the users.emailVerified timestamp into Better Auth's flag", () => {
    expect(
      convertRow(user, { id: 1, email: "a@example.com", emailVerified: "2024-01-02T03:04:05" }).emailVerified
    ).toBe(true);
    // NOT NULL with a default: a null leaves the default (false) in place.
    expect(convertRow(user, { id: 1, email: "a@example.com", emailVerified: null })).not.toHaveProperty(
      "emailVerified"
    );
  });

  it("keeps a null in a nullable column, and fills columns Postgres lacks from their defaults", () => {
    const row = convertRow(user, { id: 1, email: "a@example.com", allowDynamicBooking: null });
    expect(row.allowDynamicBooking).toBeNull();
    expect(row).not.toHaveProperty("updatedAt");
  });

  it("stores Postgres arrays and times of day in their SQLite form", () => {
    expect(
      convertRow(availability, {
        id: 1,
        days: [1, 2],
        startTime: "09:00:00",
        endTime: "17:00:00",
        date: null,
      })
    ).toMatchObject({ days: [1, 2], startTime: new Date("1970-01-01T09:00:00Z"), date: null });
  });

  it("names the column when a value can't be converted", () => {
    expect(() =>
      convertRow(eventType, { id: 1, title: "x", slug: "x", length: 15, periodType: "weekly" })
    ).toThrow(/^periodType: "weekly" is not one of/);
  });
});
