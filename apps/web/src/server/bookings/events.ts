import type { BookingStatus } from "@calcom/db/enums";
import type { BookingField } from "~/lib/booking-fields";

/** What listeners (webhooks, emails, calendar sync) need to know about a booking. */
export type BookingSnapshot = {
  id: number;
  uid: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  location: string | null;
  responses: Record<string, unknown>;
  cancellationReason: string | null;
  /** Who cancelled, by email (Cal's cancelledBy). */
  cancelledBy: string | null;
  rejectionReason: string | null;
  fromReschedule: string | null;
  eventType: {
    id: number;
    title: string;
    slug: string;
    length: number;
    /** Set for a team's event type: its booking page is /team/<teamSlug>/<slug>. */
    teamSlug?: string | null;
    /** The team's installed apps (conferencing, payments) serve its event types. */
    teamId?: number | null;
    /** Keep notes and answers out of calendar events. */
    hideCalendarNotes?: boolean;
    /** Calendar events are private on shared calendars. */
    hideCalendarEventDetails?: boolean;
    /** Attendees don't see the host's address (reply-to, invite organizer). */
    hideOrganizerEmail?: boolean;
    /** Confirmation emails workflows send instead (Cal's disableStandardEmails.confirmation). */
    disableConfirmationEmails?: { host: boolean; attendee: boolean };
  } | null;
  /** For a recurring booking, its rule and how many occurrences the series has. */
  recurring: { freq: number; interval: number; count: number } | null;
  /** The event's questions, to label the answers; null once the event type is deleted. */
  bookingFields: BookingField[] | null;
  organizer: {
    id: number;
    name: string | null;
    email: string;
    username: string | null;
    timeZone: string;
    locale: string;
  };
  attendees: {
    name: string;
    email: string;
    timeZone: string;
    phoneNumber: string | null;
    locale: string | null;
  }[];
};

export type BookingEventType =
  | "BOOKING_CREATED"
  | "BOOKING_REQUESTED"
  | "BOOKING_RESCHEDULED"
  | "BOOKING_CANCELLED"
  | "BOOKING_REJECTED"
  | "BOOKING_NO_SHOW_UPDATED"
  // Not webhook triggers in Cal; they update calendars and email the people on the booking.
  | "BOOKING_GUESTS_ADDED"
  | "BOOKING_LOCATION_CHANGED";

export type BookingEvent = {
  type: BookingEventType;
  booking: BookingSnapshot;
  rescheduledFrom?: BookingSnapshot;
  /**
   * Which occurrence of a recurring booking this is (0 first). Like Cal, people are only emailed
   * about the first; webhooks and calendars still get every occurrence.
   */
  seriesIndex?: number;
  /** Set when one booker took, moved or gave up a seat; only they (and the host) are emailed. */
  seat?: { referenceUid: string; attendeeEmail: string };
  /** For BOOKING_NO_SHOW_UPDATED: the attendees whose flag changed, and Cal's message for it. */
  noShow?: { message: string; attendees: { email: string; noShow: boolean }[] };
  /** For BOOKING_GUESTS_ADDED: who was added; they get a confirmation, the others an update. */
  guestsAdded?: string[];
  /** For BOOKING_LOCATION_CHANGED. */
  previousLocation?: string | null;
  /** A BOOKING_CANCELLED where the host asked the attendees to book a new time (Cal's request reschedule). */
  rescheduleRequested?: boolean;
  /** Missing for changes nobody in particular made, which the audit trail records as the system's. */
  actor?: BookingActor;
  /** A BOOKING_CREATED that is the host confirming a request, rather than a new booking. */
  confirmed?: boolean;
  /** The status before a cancellation. */
  previousStatus?: BookingStatus;
  /** Shared by the events one action caused, like every occurrence of a series it cancelled. */
  operationId?: string;
};

/** Who caused an event: a signed-in user, or a booker or attendee known by their email. */
export type BookingActor = { userId: number } | { email: string; name: string | null };

/** Side effects run after the booking is committed; a failing listener never fails the booking. */
export type BookingListener = (event: BookingEvent) => Promise<void>;
