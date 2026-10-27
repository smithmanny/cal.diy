import type { BookingStatus } from "@calcom/db/enums";
import type { BookingField } from "~/lib/booking-fields";

/** What listeners (webhooks, emails, calendar sync) need to know about a booking. */
export type BookingSnapshot = {
  uid: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  location: string | null;
  responses: Record<string, unknown>;
  cancellationReason: string | null;
  fromReschedule: string | null;
  eventType: {
    id: number;
    title: string;
    slug: string;
    length: number;
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
  | "BOOKING_REJECTED";

export type BookingEvent = {
  type: BookingEventType;
  booking: BookingSnapshot;
  rescheduledFrom?: BookingSnapshot;
  /**
   * Which occurrence of a recurring booking this is (0 first). Like Cal, people are only emailed
   * about the first; webhooks and calendars still get every occurrence.
   */
  seriesIndex?: number;
};

/** Side effects run after the booking is committed; a failing listener never fails the booking. */
export type BookingListener = (event: BookingEvent) => Promise<void>;
