import { describe, expect, it, vi } from "vitest";
import { BookingActionsService } from "./BookingActionsService";
import type { BookingEvent, BookingSnapshot } from "./events";

const START = new Date("2030-01-07T10:00:00Z");
const END = new Date("2030-01-07T10:30:00Z");

type Found = NonNullable<
  Awaited<ReturnType<ConstructorParameters<typeof BookingActionsService>[0]["bookingRepo"]["findByUid"]>>
>;

function bookingRow(overrides: Partial<Found> = {}): Found {
  return {
    id: 3,
    uid: "uid-1",
    userId: 7,
    status: "ACCEPTED",
    startTime: START,
    endTime: END,
    location: "Office",
    responses: { name: "Ada", email: "ada@example.com", guests: ["old@example.com"] },
    host: { email: "host@example.com", timeZone: "Europe/Paris", locale: "en" },
    eventType: { disableGuests: false },
    attendees: [{ email: "ada@example.com" }, { email: "old@example.com" }],
    ...overrides,
  };
}

function setup({ now = new Date("2030-01-07T10:05:00Z"), booking = bookingRow() } = {}) {
  const emitted: BookingEvent[] = [];
  const repo = {
    findByUid: vi.fn(async () => booking),
    setAttendeesNoShow: vi.fn(async (_id: number, updates: { email: string; noShow: boolean }[]) =>
      updates.filter((update) => update.email !== "stranger@example.com")
    ),
    addAttendees: vi.fn(async () => undefined),
    updateLocationAndMetadata: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => undefined),
  };
  const service = new BookingActionsService({
    bookingRepo: repo,
    events: {
      snapshot: async () => ({ id: 3, uid: "uid-1" }) as BookingSnapshot,
      emit: (event) => emitted.push(event),
    },
    now: () => now,
  });
  return { service, emitted, repo };
}

const before = new Date("2030-01-07T09:00:00Z");

describe("BookingActionsService.markNoShow", () => {
  it("flags the attendee and emits Cal's no-show webhook event", async () => {
    const { service, emitted } = setup();
    const result = await service.markNoShow(7, "uid-1", [{ email: "ada@example.com", noShow: true }]);
    expect(result).toEqual({
      message: "ada@example.com marked as no-show",
      attendees: [{ email: "ada@example.com", noShow: true }],
    });
    expect(emitted).toEqual([expect.objectContaining({ type: "BOOKING_NO_SHOW_UPDATED", noShow: result })]);
  });

  it("summarizes several changes and skips people not on the booking", async () => {
    const { service } = setup();
    const result = await service.markNoShow(7, "uid-1", [
      { email: "ada@example.com", noShow: false },
      { email: "grace@example.com", noShow: true },
      { email: "stranger@example.com", noShow: true },
    ]);
    expect(result.message).toBe("No-show status updated for attendees");
    expect(result.attendees).toHaveLength(2);
  });

  it("refuses before the booking starts and for other hosts' bookings", async () => {
    const early = setup({ now: before });
    const update = [{ email: "a@b.co", noShow: true }];
    await expect(early.service.markNoShow(7, "uid-1", update)).rejects.toMatchObject({
      code: "no_show_before_start",
    });
    expect(early.repo.setAttendeesNoShow).not.toHaveBeenCalled();
    const other = setup({ booking: bookingRow({ userId: 8 }) });
    await expect(other.service.markNoShow(7, "uid-1", update)).rejects.toMatchObject({
      code: "booking_not_found",
    });
  });
});

describe("BookingActionsService.addGuests", () => {
  it("adds new guests in the organizer's time zone and records them in the responses", async () => {
    const { service, repo, emitted } = setup({ now: before });
    const result = await service.addGuests(7, "uid-1", [
      "New@Example.com",
      "new@example.com",
      "ada@example.com",
      "host@example.com",
    ]);
    expect(result).toEqual({ added: ["new@example.com"] });
    expect(repo.addAttendees).toHaveBeenCalledWith(
      3,
      [{ name: "", email: "new@example.com", timeZone: "Europe/Paris", locale: "en", phoneNumber: null }],
      { name: "Ada", email: "ada@example.com", guests: ["old@example.com", "new@example.com"] }
    );
    expect(emitted).toEqual([
      expect.objectContaining({ type: "BOOKING_GUESTS_ADDED", guestsAdded: ["new@example.com"] }),
    ]);
  });

  it("refuses when nobody new is added, guests are off, or the booking is over", async () => {
    await expect(
      setup({ now: before }).service.addGuests(7, "uid-1", ["ADA@example.com"])
    ).rejects.toMatchObject({
      code: "emails_must_be_unique_valid",
    });
    const noGuests = setup({ now: before, booking: bookingRow({ eventType: { disableGuests: true } }) });
    await expect(noGuests.service.addGuests(7, "uid-1", ["x@example.com"])).rejects.toMatchObject({
      code: "guests_disabled",
    });
    const over = setup({ now: new Date("2030-01-07T11:00:00Z") });
    await expect(over.service.addGuests(7, "uid-1", ["x@example.com"])).rejects.toMatchObject({
      code: "booking_has_ended",
    });
    const cancelled = setup({ now: before, booking: bookingRow({ status: "CANCELLED" }) });
    await expect(cancelled.service.addGuests(7, "uid-1", ["x@example.com"])).rejects.toMatchObject({
      code: "event_cancelled",
    });
  });
});

describe("BookingActionsService.editLocation", () => {
  it("stores the new place and says where it was before", async () => {
    const { service, repo, emitted } = setup({ now: before });
    await service.editLocation(7, "uid-1", { type: "link", link: "https://meet.example/abc" });
    expect(repo.updateLocationAndMetadata).toHaveBeenCalledWith("uid-1", {
      location: "https://meet.example/abc",
    });
    expect(emitted).toEqual([
      expect.objectContaining({ type: "BOOKING_LOCATION_CHANGED", previousLocation: "Office" }),
    ]);
  });

  it("does nothing when the location is unchanged", async () => {
    const { service, repo, emitted } = setup({ now: before });
    await service.editLocation(7, "uid-1", { type: "inPerson", address: "Office" });
    expect(repo.updateLocationAndMetadata).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });
});

describe("BookingActionsService.requestReschedule", () => {
  it("cancels the booking as rescheduled and tells listeners a new time was requested", async () => {
    const { service, repo, emitted } = setup({ now: before });
    await service.requestReschedule(7, "uid-1", "Conflict");
    expect(repo.updateStatus).toHaveBeenCalledWith("uid-1", {
      status: "CANCELLED",
      rescheduled: true,
      cancellationReason: "Conflict",
      cancelledBy: "host@example.com",
    });
    expect(emitted).toEqual([
      expect.objectContaining({ type: "BOOKING_CANCELLED", rescheduleRequested: true }),
    ]);
  });

  it("refuses a booking that is already cancelled", async () => {
    const { service } = setup({ booking: bookingRow({ status: "REJECTED" }) });
    await expect(service.requestReschedule(7, "uid-1", null)).rejects.toMatchObject({
      code: "event_cancelled",
    });
  });
});
