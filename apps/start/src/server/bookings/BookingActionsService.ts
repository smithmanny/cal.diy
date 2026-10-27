import "@tanstack/react-start/server-only";
import { createT } from "~/lib/i18n";
import { pickMessages } from "../catalog";
import { AppError } from "../errors";
import type { BookingRepository } from "./BookingRepository";
import type { BookingService } from "./BookingService";

/** The parts of a booking these actions read; BookingRepository.findByUid returns more. */
type ActionBooking = {
  id: number;
  userId: number | null;
  startTime: Date;
  host: { locale: string | null } | null;
};

type Deps = {
  bookingRepo: Pick<BookingRepository, "setAttendeesNoShow"> & {
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
