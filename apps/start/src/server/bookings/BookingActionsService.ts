import "@tanstack/react-start/server-only";
import type { BookingStatus } from "@calcom/db/enums";
import type { JsonValue } from "@calcom/db/ids";
import { createT } from "~/lib/i18n";
import { pickMessages } from "../catalog";
import { AppError } from "../errors";
import { type EditableLocation, locationValue } from "../event-types/types";
import type { BookingRepository } from "./BookingRepository";
import type { BookingService } from "./BookingService";
import type { BookingEvent } from "./events";

function isRecord(value: unknown): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The parts of a booking these actions read; BookingRepository.findByUid returns more. */
type ActionBooking = {
  id: number;
  uid: string;
  userId: number | null;
  status: BookingStatus;
  startTime: Date;
  endTime: Date;
  location: string | null;
  responses: unknown;
  host: { email: string; timeZone: string; locale: string | null } | null;
  eventType: { disableGuests: boolean | null } | null;
  attendees: { email: string }[];
};

type Deps = {
  bookingRepo: Pick<
    BookingRepository,
    "setAttendeesNoShow" | "addAttendees" | "updateLocationAndMetadata" | "updateStatus"
  > & {
    findByUid(uid: string): Promise<ActionBooking | null>;
  };
  events: Pick<BookingService, "snapshot" | "emit">;
  now?: () => Date;
};

type NoShowUpdate = { email: string; noShow: boolean };

/** What the organizer does to a booking after it was made, besides confirming or cancelling it. */
export class BookingActionsService {
  constructor(private readonly deps: Deps) {}

  async markNoShow(
    hostId: number,
    uid: string,
    attendees: NoShowUpdate[]
  ): Promise<{ message: string; attendees: NoShowUpdate[] }> {
    const found = await this.hostBooking(hostId, uid);
    const now = this.deps.now?.() ?? new Date();
    // Nobody can be a no-show for a meeting that hasn't started.
    if (found.startTime > now) throw new AppError("no_show_before_start", 400);
    const applied = await this.deps.bookingRepo.setAttendeesNoShow(found.id, attendees);
    const message = await this.noShowMessage(found.host?.locale ?? "en", applied);
    const snapshot = await this.deps.events.snapshot(uid);
    if (snapshot && applied.length)
      this.deps.events.emit({
        type: "BOOKING_NO_SHOW_UPDATED",
        booking: snapshot,
        noShow: { message, attendees: applied },
      });
    return { message, attendees: applied };
  }

  /** Cal's add guests: new attendees get a confirmation, everyone else an update. */
  async addGuests(hostId: number, uid: string, emails: string[]): Promise<{ added: string[] }> {
    const found = await this.liveHostBooking(hostId, uid);
    if (found.eventType?.disableGuests) throw new AppError("guests_disabled", 403);
    const taken = new Set([found.host?.email, ...found.attendees.map((attendee) => attendee.email)]);
    const added = [...new Set(emails.map((email) => email.trim().toLowerCase()))].filter(
      (email) => !taken.has(email)
    );
    if (!added.length) throw new AppError("emails_must_be_unique_valid", 400);
    const responses = isRecord(found.responses) ? found.responses : {};
    const guests = Array.isArray(responses.guests) ? responses.guests : [];
    // Like Cal, guests take the organizer's time zone and language until they say otherwise.
    await this.deps.bookingRepo.addAttendees(
      found.id,
      added.map((email) => ({
        name: "",
        email,
        timeZone: found.host?.timeZone ?? "UTC",
        locale: found.host?.locale ?? "en",
        phoneNumber: null,
      })),
      { ...responses, guests: [...guests, ...added] }
    );
    await this.publish(uid, { type: "BOOKING_GUESTS_ADDED", guestsAdded: added });
    return { added };
  }

  async editLocation(hostId: number, uid: string, location: EditableLocation): Promise<void> {
    const found = await this.liveHostBooking(hostId, uid);
    const value = locationValue(location);
    if (value === found.location) return;
    await this.deps.bookingRepo.updateLocationAndMetadata(uid, { location: value });
    await this.publish(uid, { type: "BOOKING_LOCATION_CHANGED", previousLocation: found.location });
  }

  /**
   * Cal's request reschedule: the booking is cancelled and its attendees are asked to book a new
   * time, which they can do once with the same booking (see BookingService.findReschedulable).
   */
  async requestReschedule(hostId: number, uid: string, reason: string | null): Promise<void> {
    const found = await this.hostBooking(hostId, uid);
    if (found.status === "CANCELLED" || found.status === "REJECTED")
      throw new AppError("event_cancelled", 409);
    await this.deps.bookingRepo.updateStatus(uid, {
      status: "CANCELLED",
      rescheduled: true,
      cancellationReason: reason,
      cancelledBy: found.host?.email ?? null,
    });
    await this.publish(uid, { type: "BOOKING_CANCELLED", rescheduleRequested: true });
  }

  private async publish(uid: string, event: Omit<BookingEvent, "booking">): Promise<void> {
    const snapshot = await this.deps.events.snapshot(uid);
    if (snapshot) this.deps.events.emit({ ...event, booking: snapshot });
  }

  /** A booking the host can still change: not cancelled, rejected or over. */
  private async liveHostBooking(hostId: number, uid: string) {
    const found = await this.hostBooking(hostId, uid);
    if (found.status === "CANCELLED" || found.status === "REJECTED")
      throw new AppError("event_cancelled", 409);
    if (found.endTime <= (this.deps.now?.() ?? new Date())) throw new AppError("booking_has_ended", 409);
    return found;
  }

  private async hostBooking(hostId: number, uid: string) {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found || found.userId !== hostId) throw new AppError("booking_not_found", 404);
    return found;
  }

  /** Cal sends this message pre-translated in its webhook, in the organizer's language. */
  private async noShowMessage(locale: string, applied: NoShowUpdate[]): Promise<string> {
    const keys = ["x_marked_as_no_show", "x_unmarked_as_no_show", "no_show_updated"];
    const t = createT(await pickMessages(locale, keys), locale);
    const [only] = applied;
    if (applied.length !== 1 || !only) return t("no_show_updated");
    return t(only.noShow ? "x_marked_as_no_show" : "x_unmarked_as_no_show", { x: only.email });
  }
}
