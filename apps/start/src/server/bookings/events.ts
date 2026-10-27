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
  eventType: { id: number; title: string; slug: string; length: number } | null;
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
};

/** Side effects run after the booking is committed; a failing listener never fails the booking. */
export type BookingListener = (event: BookingEvent) => Promise<void>;
