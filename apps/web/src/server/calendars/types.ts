import type { BusyInterval } from "@calcom/scheduling/available-slots";

export type CalendarListEntry = { id: string; name: string; primary: boolean };

export type CalendarEventInput = {
  /** The booking uid; providers that address events by a client-chosen id (CalDAV) use it. */
  uid: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  location: string | null;
  organizer: { name: string | null; email: string };
  attendees: { email: string; displayName?: string }[];
  /** Ask Google for a Meet conference; other providers ignore it. */
  googleMeet?: boolean;
  /** Hide the details from people the calendar is shared with (Cal's hideCalendarEventDetails). */
  private?: boolean;
};

export type CreatedCalendarEvent = { id: string; meetUrl: string | null };

/** What booking sync needs from any calendar provider. */
export interface CalendarClient {
  listCalendars(): Promise<CalendarListEntry[]>;
  busyTimes(calendarIds: string[], from: Date, to: Date): Promise<BusyInterval[]>;
  createEvent(calendarId: string, event: CalendarEventInput): Promise<CreatedCalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

/** A calendar app: how to open its stored credential key, plus its OAuth hooks if it has any. */
export type CalendarProvider = {
  /** Credential.type, also used for SelectedCalendar.integration and BookingReference.type. */
  type: string;
  open(key: unknown, onKeyChange: (key: unknown) => Promise<void>): CalendarClient;
  exchangeCode?(code: string): Promise<unknown>;
  /** Courtesy revocation when disconnecting; failures are ignored. */
  revoke?(key: unknown): Promise<void>;
};
