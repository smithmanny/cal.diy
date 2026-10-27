import type { Database } from "@calcom/db/database";
import { user } from "@calcom/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { auditEntries, createAuditListener } from "./auditListener";
import { BookingAuditRepository } from "./BookingAuditRepository";
import type { BookingSnapshot } from "./events";

const booking = {
  id: 1,
  uid: "b1",
  title: "Intro",
  startTime: new Date("2030-01-07T10:00:00Z"),
  endTime: new Date("2030-01-07T10:30:00Z"),
  status: "ACCEPTED",
  location: "https://meet.example/new",
  cancellationReason: "Busy",
  cancelledBy: "host@example.com",
  rejectionReason: null,
  organizer: { id: 1 },
  attendees: [{ name: "Ada", email: "ada@example.com" }],
} as unknown as BookingSnapshot;

describe("auditEntries", () => {
  it("records new bookings with their host, and confirmations as accepted", () => {
    expect(auditEntries({ type: "BOOKING_CREATED", booking }, "u-1")).toEqual([
      {
        bookingUid: "b1",
        action: "CREATED",
        fields: {
          startTime: booking.startTime.getTime(),
          endTime: booking.endTime.getTime(),
          status: "ACCEPTED",
          hostUserUuid: "u-1",
        },
      },
    ]);
    expect(auditEntries({ type: "BOOKING_CREATED", booking, confirmed: true }, null)[0].action).toBe(
      "ACCEPTED"
    );
  });

  it("records a reschedule on the old booking and a creation on the new one", () => {
    const from = { ...booking, uid: "b0", startTime: new Date("2030-01-06T10:00:00Z") };
    const entries = auditEntries({ type: "BOOKING_RESCHEDULED", booking, rescheduledFrom: from }, null);
    expect(entries.map((entry) => [entry.bookingUid, entry.action])).toEqual([
      ["b0", "RESCHEDULED"],
      ["b1", "CREATED"],
    ]);
    expect(entries[0].fields.rescheduledToUid).toEqual({ old: null, new: "b1" });
  });

  it("tells cancellations from reschedule requests, and records host changes", () => {
    expect(
      auditEntries({ type: "BOOKING_CANCELLED", booking, previousStatus: "ACCEPTED" }, null)[0]
    ).toMatchObject({
      action: "CANCELLED",
      fields: { cancellationReason: "Busy", status: { old: "ACCEPTED", new: "CANCELLED" } },
    });
    expect(
      auditEntries({ type: "BOOKING_CANCELLED", booking, rescheduleRequested: true }, null)[0]
    ).toMatchObject({
      action: "RESCHEDULE_REQUESTED",
      fields: { rescheduleReason: "Busy", rescheduledRequestedBy: "host@example.com" },
    });
    expect(
      auditEntries({ type: "BOOKING_LOCATION_CHANGED", booking, previousLocation: "Office" }, null)[0].fields
    ).toEqual({ location: { old: "Office", new: "https://meet.example/new" } });
    expect(
      auditEntries({ type: "BOOKING_GUESTS_ADDED", booking, guestsAdded: ["x@example.com"] }, null)[0]
    ).toMatchObject({
      action: "ATTENDEE_ADDED",
      fields: { added: ["x@example.com"] },
    });
    expect(
      auditEntries(
        {
          type: "BOOKING_NO_SHOW_UPDATED",
          booking,
          noShow: { message: "", attendees: [{ email: "ada@example.com", noShow: true }] },
        },
        null
      )[0].fields
    ).toEqual({ attendeesNoShow: [{ attendeeEmail: "ada@example.com", noShow: { old: null, new: true } }] });
  });
});

describe("createAuditListener", () => {
  let db: Database;
  let repo: BookingAuditRepository;
  beforeEach(async () => {
    db = await createTestDb();
    repo = new BookingAuditRepository(db);
  });

  it("stores entries in Cal's format with whoever acted", async () => {
    const [host] = await db
      .insert(user)
      .values({ email: "host@example.com", name: "Hana" })
      .returning({ id: user.id, uuid: user.uuid });
    const listener = createAuditListener(repo, () => new Date("2030-01-01T00:00:00Z"));
    const hostBooking = { ...booking, organizer: { ...booking.organizer, id: host.id } };
    await listener({
      type: "BOOKING_CREATED",
      booking: hostBooking,
      actor: { email: "Ada@Example.com", name: "Ada" },
    });
    await listener({ type: "BOOKING_CANCELLED", booking: hostBooking, actor: { userId: host.id } });
    await listener({ type: "BOOKING_REJECTED", booking: hostBooking });

    const rows = await repo.findByBookingUid("b1");
    expect(rows.map((row) => [row.action, row.actorType, row.actorName, row.actorEmail])).toEqual([
      ["CREATED", "GUEST", "Ada", "ada@example.com"],
      ["CANCELLED", "USER", "Hana", "host@example.com"],
      ["REJECTED", "SYSTEM", null, null],
    ]);
    expect(rows[0].data).toMatchObject({ version: 1, fields: { hostUserUuid: host.uuid } });
    expect(await repo.userNamesByUuid([host.uuid])).toEqual(new Map([[host.uuid, "Hana"]]));
    // Actors are reused rather than duplicated.
    await listener({
      type: "BOOKING_CANCELLED",
      booking: hostBooking,
      actor: { email: "ada@example.com", name: null },
    });
    const again = await repo.findByBookingUid("b1");
    expect(again.at(-1)).toMatchObject({ actorName: "Ada" });
  });
});
