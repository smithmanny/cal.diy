import type { Database } from "@calcom/db/database";
import { attendee, booking, eventType, user } from "@calcom/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { ApiBookingRepository, type BookingListQuery } from "./ApiBookingRepository";

let db: Database;
let repo: ApiBookingRepository;
let hostId: number;
let eventTypeId: number;
const NOW = new Date("2030-01-10T00:00:00Z");

beforeEach(async () => {
  db = await createTestDb();
  repo = new ApiBookingRepository(db);
  [{ id: hostId }] = await db
    .insert(user)
    .values({ email: "host@example.com", username: "host" })
    .returning({ id: user.id });
  [{ id: eventTypeId }] = await db
    .insert(eventType)
    .values({ userId: hostId, title: "Intro", slug: "intro", length: 30 })
    .returning({ id: eventType.id });
});

async function addBooking(
  uid: string,
  start: string,
  overrides: Partial<typeof booking.$inferInsert> = {},
  guest = { name: "Ada Lovelace", email: "ada@example.com" }
) {
  const startTime = new Date(start);
  const [{ id }] = await db
    .insert(booking)
    .values({
      uid,
      userId: hostId,
      eventTypeId,
      title: "Intro",
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60_000),
      createdAt: startTime,
      ...overrides,
    })
    .returning({ id: booking.id });
  await db.insert(attendee).values({ bookingId: id, timeZone: "UTC", ...guest });
}

function query(overrides: Partial<BookingListQuery> = {}): BookingListQuery {
  return {
    userId: hostId,
    email: "host@example.com",
    now: NOW,
    sort: { column: "startTime", direction: "asc" },
    take: 10,
    skip: 0,
    ...overrides,
  };
}

const uids = (result: { bookings: { uid: string }[] }) => result.bookings.map((row) => row.uid);

describe("ApiBookingRepository", () => {
  beforeEach(async () => {
    await addBooking("past", "2030-01-05T10:00:00Z");
    await addBooking("upcoming", "2030-01-12T10:00:00Z");
    await addBooking(
      "pending",
      "2030-01-13T10:00:00Z",
      { status: "PENDING" },
      { name: "Bob", email: "bob@x.io" }
    );
    await addBooking("cancelled", "2030-01-14T10:00:00Z", { status: "CANCELLED" });
    await addBooking("moved", "2030-01-15T10:00:00Z", { fromReschedule: "cancelled" });
  });

  it("filters by Cal's statuses, which combine", async () => {
    expect(uids(await repo.findMany(query({ statuses: ["upcoming"] })))).toEqual([
      "upcoming",
      "pending",
      "moved",
    ]);
    expect(uids(await repo.findMany(query({ statuses: ["unconfirmed"] })))).toEqual(["pending"]);
    expect(uids(await repo.findMany(query({ statuses: ["past", "cancelled"] })))).toEqual([
      "past",
      "cancelled",
    ]);
  });

  it("filters by attendee, case-insensitively, and pages with a total", async () => {
    expect(uids(await repo.findMany(query({ attendeeEmail: "BOB@x.io" })))).toEqual(["pending"]);
    expect(uids(await repo.findMany(query({ attendeeName: "love" })))).toHaveLength(4);
    expect(uids(await repo.findMany(query({ attendeeName: "100%" })))).toEqual([]);
    const page = await repo.findMany(
      query({ take: 2, skip: 2, sort: { column: "startTime", direction: "desc" } })
    );
    expect(page.total).toBe(5);
    expect(uids(page)).toEqual(["pending", "upcoming"]);
  });

  it("lists bookings the user attends, but not other people's", async () => {
    const [{ id: otherId }] = await db
      .insert(user)
      .values({ email: "other@example.com" })
      .returning({ id: user.id });
    await addBooking("theirs", "2030-01-20T10:00:00Z", { userId: otherId });
    await addBooking(
      "invited",
      "2030-01-21T10:00:00Z",
      { userId: otherId },
      { name: "Host", email: "Host@Example.com" }
    );
    expect(uids(await repo.findMany(query({ afterStart: new Date("2030-01-16T00:00:00Z") })))).toEqual([
      "invited",
    ]);
  });

  it("reads a booking with its host, attendees and the booking that replaced it", async () => {
    const found = await repo.findByUid("cancelled");
    expect(found).toMatchObject({
      uid: "cancelled",
      status: "CANCELLED",
      eventTypeSlug: "intro",
      hostUsername: "host",
      rescheduledToUid: "moved",
      attendees: [{ name: "Ada Lovelace", email: "ada@example.com", noShow: false }],
    });
    expect(await repo.findByUid("missing")).toBeNull();
  });
});
