import "@tanstack/react-start/server-only";

import type { Messages } from "~/lib/i18n";
import type { BookingEvent, BookingSnapshot } from "../bookings/events";
import { buildIcs } from "./ics";
import type { EmailSender } from "./sender";
import {
  AUTH_EMAIL_MESSAGE_KEYS,
  type AuthEmailKind,
  CODE_EMAIL_MESSAGE_KEYS,
  EMAIL_MESSAGE_KEYS,
  type EmailKind,
  renderAuthEmail,
  renderBookingEmail,
  renderCodeEmail,
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
  BOOKING_GUESTS_ADDED: {
    attendee: "attendee_guests_added",
    organizer: "organizer_guests_added",
    method: "REQUEST",
    sequence: 1,
  },
  BOOKING_LOCATION_CHANGED: {
    attendee: "attendee_location_changed",
    organizer: "organizer_location_changed",
    method: "REQUEST",
    sequence: 1,
  },
};

const RESCHEDULE_REQUESTED: Plan = {
  attendee: "attendee_reschedule_requested",
  organizer: "organizer_reschedule_requested",
  method: "CANCEL",
  sequence: 1,
};

function planFor(event: BookingEvent): Plan | undefined {
  return event.rescheduleRequested ? RESCHEDULE_REQUESTED : PLANS[event.type];
}

/** The bare address of a sender like "Cal.diy <cal@example.com>". */
function senderAddress(from: string): string {
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

/** Cal's booking emails: a confirmation/update for each attendee and the organizer, with an .ics. */
export class EmailService {
  constructor(private readonly deps: Deps) {}

  async onBookingEvent(event: BookingEvent): Promise<void> {
    const plan = planFor(event);
    // One email covers a whole recurring series, as in Cal.
    if (!plan || (event.seriesIndex ?? 0) > 0) return;
    const booking = event.booking;
    const manageUrl = `${this.deps.publicUrl}/booking/${booking.uid}`;
    const hideOrganizerEmail = Boolean(booking.eventType?.hideOrganizerEmail);
    const icsContent = buildIcs(booking, {
      method: plan.method,
      sequence: plan.sequence,
      manageUrl,
      organizerEmail: hideOrganizerEmail ? senderAddress(this.deps.from) : undefined,
    });
    const ics = { content: icsContent, method: plan.method };
    const sends: Promise<void>[] = [];
    // Like Cal, turning off standard emails only drops the confirmation; updates still go out.
    const isConfirmation = event.type === "BOOKING_CREATED" || event.type === "BOOKING_REQUESTED";
    const disabled = isConfirmation ? booking.eventType?.disableConfirmationEmails : undefined;

    if (plan.attendee && !disabled?.attendee) {
      // A seat change concerns one booker; the others don't hear about it.
      const recipients = event.seat
        ? booking.attendees.filter((attendee) => attendee.email === event.seat?.attendeeEmail)
        : booking.attendees;
      const attendeeUrl =
        plan.attendee === "attendee_reschedule_requested" ? this.rebookUrl(booking, manageUrl) : manageUrl;
      for (const attendee of recipients) {
        sends.push(
          this.sendOne(
            // Guests just added hear about the booking for the first time.
            event.guestsAdded?.includes(attendee.email) ? "attendee_scheduled" : plan.attendee,
            booking,
            { email: attendee.email, timeZone: attendee.timeZone, locale: attendee.locale ?? "en" },
            attendeeUrl,
            ics,
            hideOrganizerEmail ? undefined : booking.organizer.email
          )
        );
      }
    }
    if (plan.organizer && !disabled?.host) {
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

  /** Where attendees book a new time after the host asked them to (Cal's `rescheduleUid` link). */
  private rebookUrl(booking: BookingSnapshot, fallback: string): string {
    const { username } = booking.organizer;
    if (!username || !booking.eventType) return fallback;
    return `${this.deps.publicUrl}/${username}/${booking.eventType.slug}?rescheduleUid=${booking.uid}`;
  }

  /** A booker's verification code; failures reach the caller so the booker can retry. */
  async sendBookerCode(email: string, code: string, locale: string): Promise<void> {
    const messages = await this.deps.loadMessages(locale, CODE_EMAIL_MESSAGE_KEYS);
    const { subject, html, text } = renderCodeEmail(code, messages);
    await this.deps.send({ from: this.deps.from, to: email, subject, html, text });
  }

  private async sendOne(
    kind: EmailKind,
    booking: BookingSnapshot,
    recipient: { email: string; timeZone: string; locale: string },
    manageUrl: string,
    ics: { content: string; method: "REQUEST" | "CANCEL" },
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
          content: ics.content,
          contentType: `text/calendar; method=${ics.method}`,
        },
      ],
    });
  }
}
