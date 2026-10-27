import { describe, expect, it, vi } from "vitest";
import { BookingActionsService } from "./BookingActionsService";
import type { BookingEvent, BookingSnapshot } from "./events";

const START = new Date("2030-01-07T10:00:00Z");

function setup({ now = new Date("2030-01-07T10:05:00Z"), userId = 7 } = {}) {
  const emitted: BookingEvent[] = [];
  const setAttendeesNoShow = vi.fn(async (_id: number, updates: { email: string; noShow: boolean }[]) =>
    updates.filter((update) => update.email !== "stranger@example.com")
  );
  const service = new BookingActionsService({
    bookingRepo: {
      findByUid: vi.fn(async () => ({ id: 3, userId, startTime: START, host: { locale: "en" } })),
      setAttendeesNoShow,
    },
    events: {
      snapshot: async () => ({ id: 3, uid: "uid-1" }) as BookingSnapshot,
      emit: (event) => emitted.push(event),
    },
    now: () => now,
  });
  return { service, emitted, setAttendeesNoShow };
}

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
    const early = setup({ now: new Date("2030-01-07T09:00:00Z") });
    await expect(
      early.service.markNoShow(7, "uid-1", [{ email: "a@b.co", noShow: true }])
    ).rejects.toMatchObject({
      code: "no_show_before_start",
    });
    expect(early.setAttendeesNoShow).not.toHaveBeenCalled();
    const other = setup({ userId: 8 });
    await expect(
      other.service.markNoShow(7, "uid-1", [{ email: "a@b.co", noShow: true }])
    ).rejects.toMatchObject({
      code: "booking_not_found",
    });
  });
});
