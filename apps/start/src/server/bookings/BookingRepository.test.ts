import type { Database } from "@calcom/db/database";
import { attendee, booking, eventType, user } from "@calcom/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { BookingRepository, type NewBooking } from "./BookingRepository";

let db: Database;
let repo: BookingRepository;
let hostId: number;
let eventTypeId: number;

beforeEach(async () => {
  db = await createTestDb();
  repo = new BookingRepository(db);
  [{ id: hostId }] = await db.insert(user).values({ email: "host@example.com" }).returning({ id: user.id });
  [{ id: eventTypeId }] = await db
    .insert(eventType)
    .values({ userId: hostId, title: "Intro", slug: "intro", length: 30, afterEventBuffer: 10 })
    .returning({ id: eventType.id });
});

function newBooking(start: string, overrides: Partial<NewBooking> = {}): NewBooking {
  const startTime = new Date(start);
  return {
    uid: crypto.randomUUID(),
    userId: hostId,
    userPrimaryEmail: "host@example.com",
    eventTypeId,
    title: "Intro",
    description: null,
    startTime,
    endTime: new Date(startTime.getTime() + 30 * 60_000),
    location: null,
    status: "ACCEPTED",
    responses: { name: "Guest", email: "guest@example.com" },
    fromReschedule: null,
    attendees: [
      { name: "Guest", email: "Guest@Example.com", timeZone: "UTC", locale: "en", phoneNumber: null },
    ],
    ...overrides,
  };
}

describe("BookingRepository.insertIfSlotFree", () => {
  it("inserts the booking and its attendee atomically", async () => {
    const data = newBooking("2030-01-07T10:00:00Z");
    expect(await repo.insertIfSlotFree(data)).toBe(true);

    const found = await repo.findByUid(data.uid);
    expect(found).toMatchObject({
      title: "Intro",
      status: "ACCEPTED",
      startTime: data.startTime,
      responses: { name: "Guest", email: "guest@example.com" },
      eventType: { slug: "intro" },
      host: { email: "host@example.com" },
      attendees: [{ name: "Guest", email: "guest@example.com", timeZone: "UTC", phoneNumber: null }],
    });
  });

  it("refuses an overlapping booking for the same host and leaves no stray attendee", async () => {
    expect(await repo.insertIfSlotFree(newBooking("2030-01-07T10:00:00Z"))).toBe(true);
    expect(await repo.insertIfSlotFree(newBooking("2030-01-07T10:15:00Z"))).toBe(false);
    expect(await db.select({ id: booking.id }).from(booking)).toHaveLength(1);
    expect(await db.select({ id: attendee.id }).from(attendee)).toHaveLength(1);
  });

  it("lets back-to-back and cancelled-slot bookings through", async () => {
    const first = newBooking("2030-01-07T10:00:00Z");
    await repo.insertIfSlotFree(first);
    expect(await repo.insertIfSlotFree(newBooking("2030-01-07T10:30:00Z"))).toBe(true);
    await repo.updateStatus(first.uid, { status: "CANCELLED" });
    expect(await repo.insertIfSlotFree(newBooking("2030-01-07T10:00:00Z"))).toBe(true);
  });

  it("only one of two simultaneous requests for the same slot wins", async () => {
    const results = await Promise.all([
      repo.insertIfSlotFree(newBooking("2030-01-07T11:00:00Z")),
      repo.insertIfSlotFree(newBooking("2030-01-07T11:00:00Z")),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("BookingRepository.findBusyForUser", () => {
  it("returns accepted bookings as host or attendee with the event's buffers", async () => {
    await repo.insertIfSlotFree(newBooking("2030-01-07T10:00:00Z"));
    await repo.insertIfSlotFree(newBooking("2030-01-07T12:00:00Z", { status: "PENDING" }));
    // Host booked someone else's event as an attendee
    const [{ id: otherHost }] = await db
      .insert(user)
      .values({ email: "other@example.com" })
      .returning({ id: user.id });
    await repo.insertIfSlotFree(
      newBooking("2030-01-07T14:00:00Z", {
        userId: otherHost,
        attendees: [
          {
            name: "Other",
            email: "other-guest@example.com",
            timeZone: "UTC",
            locale: "en",
            phoneNumber: null,
          },
          // The host is a guest on someone else's booking, so that time is busy for them too.
          { name: "", email: "host@example.com", timeZone: "UTC", locale: "en", phoneNumber: null },
        ],
      })
    );

    const busy = await repo.findBusyForUser({
      userId: hostId,
      email: "host@example.com",
      from: new Date("2030-01-07T00:00:00Z"),
      to: new Date("2030-01-08T00:00:00Z"),
    });
    expect(busy.map((b) => [b.start.toISOString(), b.afterBuffer]).sort()).toEqual([
      ["2030-01-07T10:00:00.000Z", 10],
      ["2030-01-07T14:00:00.000Z", 10],
    ]);
  });
});
