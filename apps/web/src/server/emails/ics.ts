import type { BookingSnapshot } from "../bookings/events";

function stamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

// RFC 5545 text escaping and 75-octet line folding (approximated by characters).
function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, ";").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push((i ? " " : "") + line.slice(i, i + 74));
  return parts.join("\r\n");
}

/** An iCalendar invite (or cancellation) for the booking, attached to emails like Cal does. */
export function buildIcs(
  booking: BookingSnapshot,
  options: {
    method: "REQUEST" | "CANCEL";
    sequence: number;
    manageUrl: string;
    /** Stands in for the host's address when the event type hides it. */
    organizerEmail?: string;
  }
): string {
  const organizerEmail = options.organizerEmail ?? booking.organizer.email;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cal.diy//EN",
    `METHOD:${options.method}`,
    "BEGIN:VEVENT",
    // Matches Booking.iCalUID, so calendar apps update the same event on reschedule/cancel.
    `UID:${booking.fromReschedule ?? booking.uid}@cal.diy`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(booking.startTime)}`,
    `DTEND:${stamp(booking.endTime)}`,
    `SEQUENCE:${options.sequence}`,
    `SUMMARY:${escape(booking.title)}`,
    `DESCRIPTION:${escape(`${booking.eventType?.title ?? booking.title}\n${options.manageUrl}`)}`,
    ...(booking.location ? [`LOCATION:${escape(booking.location)}`] : []),
    `ORGANIZER;CN=${escape(booking.organizer.name ?? organizerEmail)}:mailto:${organizerEmail}`,
    ...booking.attendees.map(
      (attendee) =>
        `ATTENDEE;CN=${escape(attendee.name || attendee.email)};RSVP=TRUE:mailto:${attendee.email}`
    ),
    `STATUS:${options.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
