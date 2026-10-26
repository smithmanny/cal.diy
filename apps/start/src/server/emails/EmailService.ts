import "@tanstack/react-start/server-only";

import type { Messages } from "~/lib/i18n";
import type { BookingEvent, BookingSnapshot } from "../bookings/events";
import { buildIcs } from "./ics";
import type { EmailSender } from "./sender";
import {
  AUTH_EMAIL_MESSAGE_KEYS,
  type AuthEmailKind,
  EMAIL_MESSAGE_KEYS,
  type EmailKind,
  renderAuthEmail,
  renderBookingEmail,
} from "./templates";

type Deps = {
  send: EmailSender;
  from: string;
  publicUrl: string;
  loadMessages: (locale: string, keys: readonly string[]) => Promise<Messages>;
};

type Plan = { attendee?: EmailKind; organizer?: EmailKind; method: "REQUEST" | "CANCEL"; sequence: number };

const PLANS: Partial<Record<BookingEvent["type"], Plan>> = {
  BOOKING_CREATED: {
    attendee: "attendee_scheduled",
    organizer: "organizer_scheduled",
    method: "REQUEST",
    sequence: 0,
  },
  BOOKING_REQUESTED: {
    attendee: "attendee_requested",
    organizer: "organizer_requested",
    method: "REQUEST",
    sequence: 0,
  },
  BOOKING_RESCHEDULED: {
    attendee: "attendee_rescheduled",
    organizer: "organizer_rescheduled",
    method: "REQUEST",
    sequence: 1,
  },
  BOOKING_CANCELLED: {
    attendee: "attendee_cancelled",
    organizer: "organizer_cancelled",
    method: "CANCEL",
    sequence: 1,
  },
  BOOKING_REJECTED: { attendee: "attendee_rejected", method: "CANCEL", sequence: 1 },
};

/** Cal's booking emails: a confirmation/update for each attendee and the organizer, with an .ics. */
export class EmailService {
  constructor(private readonly deps: Deps) {}

  async onBookingEvent(event: BookingEvent): Promise<void> {
    const plan = PLANS[event.type];
    if (!plan) return;
    const booking = event.booking;
    const manageUrl = `${this.deps.publicUrl}/booking/${booking.uid}`;
    const ics = buildIcs(booking, { method: plan.method, sequence: plan.sequence, manageUrl });
    const sends: Promise<void>[] = [];

    if (plan.attendee) {
      for (const attendee of booking.attendees) {
        sends.push(
          this.sendOne(
            plan.attendee,
            booking,
            { email: attendee.email, timeZone: attendee.timeZone, locale: attendee.locale ?? "en" },
            manageUrl,
            ics,
            booking.organizer.email
          )
        );
      }
    }
    if (plan.organizer) {
      const organizerUrl =
        plan.organizer === "organizer_requested" ? `${this.deps.publicUrl}/bookings/unconfirmed` : manageUrl;
      const { email, timeZone, locale } = booking.organizer;
      sends.push(
        this.sendOne(
          plan.organizer,
          booking,
          { email, timeZone, locale },
          organizerUrl,
          ics,
          booking.attendees[0]?.email
        )
      );
    }
    const results = await Promise.allSettled(sends);
    for (const result of results) {
      if (result.status === "rejected") console.error(`Sending ${event.type} email failed`, result.reason);
    }
  }

  /** Password reset and email verification links; unlike booking emails, failures reach the caller. */
  async sendAuthEmail(
    kind: AuthEmailKind,
    recipient: { email: string; name: string | null; locale: string | null },
    url: string
  ): Promise<void> {
    const messages = await this.deps.loadMessages(recipient.locale ?? "en", AUTH_EMAIL_MESSAGE_KEYS);
    const { subject, html, text } = renderAuthEmail(kind, recipient, url, messages);
    await this.deps.send({ from: this.deps.from, to: recipient.email, subject, html, text });
  }

  private async sendOne(
    kind: EmailKind,
    booking: BookingSnapshot,
    recipient: { email: string; timeZone: string; locale: string },
    manageUrl: string,
    ics: string,
    replyTo: string | undefined
  ): Promise<void> {
    const messages = await this.deps.loadMessages(recipient.locale, EMAIL_MESSAGE_KEYS);
    const { subject, html, text } = renderBookingEmail(kind, booking, recipient, messages, manageUrl);
    await this.deps.send({
      from: this.deps.from,
      to: recipient.email,
      replyTo,
      subject,
      html,
      text,
      attachments: [
        {
          filename: "invite.ics",
          content: ics,
          contentType: `text/calendar; method=${kind.endsWith("cancelled") || kind.endsWith("rejected") ? "CANCEL" : "REQUEST"}`,
        },
      ],
    });
  }
}
