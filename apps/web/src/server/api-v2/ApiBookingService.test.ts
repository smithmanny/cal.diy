import { describe, expect, it, vi } from "vitest";
import type { BookingActionsService } from "../bookings/BookingActionsService";
import type { BookingService } from "../bookings/BookingService";
import type { EventTypeRepository } from "../event-types/EventTypeRepository";
import type { TeamRepository } from "../teams/TeamRepository";
import type { ApiBookingRepository } from "./ApiBookingRepository";
import { ApiBookingService } from "./ApiBookingService";
import type { ApiUserRepository } from "./ApiUserRepository";
import { addGuestsInputSchema, markAbsentInputSchema, updateLocationInputSchema } from "./bookingMapper";
import { ApiInputError } from "./http";

function setup() {
  const actions = {
    markNoShow: vi.fn<BookingActionsService["markNoShow"]>(async () => ({ message: "", attendees: [] })),
    addGuests: vi.fn<BookingActionsService["addGuests"]>(async () => ({ added: [] })),
    editLocation: vi.fn<BookingActionsService["editLocation"]>(async () => undefined),
  };
  const service = new ApiBookingService({
    bookings: {} as BookingService,
    actions: actions as unknown as BookingActionsService,
    apiBookings: { findByUid: vi.fn(async () => null) } as unknown as ApiBookingRepository,
    eventTypeRepo: {} as EventTypeRepository,
    users: {} as ApiUserRepository,
    teams: {} as TeamRepository,
  });
  // The booking read back after each action isn't what these tests are about.
  vi.spyOn(service, "get").mockResolvedValue({} as Awaited<ReturnType<ApiBookingService["get"]>>);
  return { service, actions };
}

const host = { id: 1 };

describe("ApiBookingService booking actions", () => {
  it("marks attendees absent through the no-show action, and refuses a host no-show", async () => {
    const { service, actions } = setup();
    await service.markAbsent(
      "uid",
      host,
      markAbsentInputSchema.parse({ attendees: [{ email: "a@example.com", absent: true }] })
    );
    expect(actions.markNoShow).toHaveBeenCalledWith(1, "uid", [{ email: "a@example.com", noShow: true }]);
    await expect(service.markAbsent("uid", host, { host: true })).rejects.toBeInstanceOf(ApiInputError);
    await service.markAbsent("uid", host, { host: false });
    expect(actions.markNoShow).toHaveBeenCalledTimes(1);
  });

  it("adds guests with the details given, and rejects an unknown time zone", async () => {
    const { service, actions } = setup();
    const input = addGuestsInputSchema.parse({
      guests: [{ email: "g@example.com", name: "G", timeZone: "Asia/Tokyo", language: "ja" }],
    });
    await service.addGuests("uid", host, input);
    expect(actions.addGuests).toHaveBeenCalledWith(1, "uid", [
      { email: "g@example.com", name: "G", timeZone: "Asia/Tokyo", locale: "ja" },
    ]);
    expect(
      addGuestsInputSchema.safeParse({ guests: [{ email: "g@example.com", timeZone: "Mars/Base" }] }).success
    ).toBe(false);
  });

  it("maps Cal's location types onto the app's, and rejects the rest", async () => {
    const { service, actions } = setup();
    const change = (location: unknown) => updateLocationInputSchema.parse({ location });
    await service.updateLocation("uid", host, change({ type: "address", address: "1 Main St" }));
    await service.updateLocation("uid", host, change({ type: "phone", phone: "+44 20 1234 5678" }));
    await service.updateLocation("uid", host, change({ type: "integration", integration: "google-meet" }));
    expect(actions.editLocation.mock.calls.map(([, , location]) => location)).toEqual([
      { type: "inPerson", address: "1 Main St" },
      { type: "userPhone", hostPhoneNumber: "+44 20 1234 5678" },
      { type: "integrations:google:meet" },
    ]);
    expect(
      updateLocationInputSchema.safeParse({ location: { type: "attendeeDefined", location: "x" } }).success
    ).toBe(false);
    expect(
      updateLocationInputSchema.safeParse({ location: { type: "integration", integration: "zoom" } }).success
    ).toBe(false);
  });
});

describe("ApiBookingService.eventTypeLink", () => {
  it("books a team's event type through its team page", async () => {
    const service = new ApiBookingService({
      bookings: {} as BookingService,
      actions: {} as BookingActionsService,
      apiBookings: {} as ApiBookingRepository,
      eventTypeRepo: {
        findById: vi.fn(async () => ({ id: 9, slug: "demo", userId: null, teamId: 3 })),
      } as unknown as EventTypeRepository,
      users: {} as ApiUserRepository,
      teams: { findById: vi.fn(async () => ({ slug: "crew" })) } as unknown as TeamRepository,
    });
    expect(await service.eventTypeLink({ eventTypeId: 9 })).toEqual({ username: "team:crew", slug: "demo" });
  });
});
