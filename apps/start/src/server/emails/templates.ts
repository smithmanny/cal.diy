import { formatLongDate, formatTime } from "~/lib/date-utils";
import type { Messages } from "~/lib/i18n";
import { createT } from "~/lib/i18n";
import type { BookingSnapshot } from "../bookings/events";

export type EmailKind =
  | "attendee_scheduled"
  | "attendee_requested"
  | "attendee_rescheduled"
  | "attendee_cancelled"
  | "attendee_rejected"
  | "organizer_scheduled"
  | "organizer_requested"
  | "organizer_rescheduled"
  | "organizer_cancelled";

type Content = { subjectKey: string; headingKey: string; showManageLinks: boolean };

const CONTENT: Record<EmailKind, Content> = {
  attendee_scheduled: {
    subjectKey: "confirmed_event_type_subject",
    headingKey: "your_event_has_been_scheduled",
    showManageLinks: true,
  },
  attendee_requested: {
    subjectKey: "booking_submitted_subject",
    headingKey: "booking_submitted",
    showManageLinks: true,
  },
  attendee_rescheduled: {
    subjectKey: "event_type_has_been_rescheduled_on_time_date",
    headingKey: "event_has_been_rescheduled",
    showManageLinks: true,
  },
  attendee_cancelled: {
    subjectKey: "event_cancelled_subject",
    headingKey: "event_request_cancelled",
    showManageLinks: false,
  },
  attendee_rejected: {
    subjectKey: "event_request_declined",
    headingKey: "event_request_declined",
    showManageLinks: false,
  },
  organizer_scheduled: {
    subjectKey: "new_event_subject",
    headingKey: "new_event_scheduled",
    showManageLinks: true,
  },
  organizer_requested: {
    subjectKey: "event_awaiting_approval_subject",
    headingKey: "event_awaiting_approval",
    showManageLinks: true,
  },
  organizer_rescheduled: {
    subjectKey: "event_type_has_been_rescheduled_on_time_date",
    headingKey: "event_has_been_rescheduled",
    showManageLinks: true,
  },
  organizer_cancelled: {
    subjectKey: "event_cancelled_subject",
    headingKey: "event_request_cancelled",
    showManageLinks: false,
  },
};

export const EMAIL_MESSAGE_KEYS = [
  ...new Set(Object.values(CONTENT).flatMap((c) => [c.subjectKey, c.headingKey])),
  "what",
  "when",
  "who",
  "where",
  "additional_notes",
  "cancellation_reason",
  "organizer",
  "need_to_make_a_change",
  "manage_this_event",
  "confirm_or_reject_request",
];

const htmlEscape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderBookingEmail(
  kind: EmailKind,
  booking: BookingSnapshot,
  recipient: { timeZone: string; locale: string },
  messages: Messages,
  manageUrl: string
): { subject: string; html: string; text: string } {
  const t = createT(messages);
  const content = CONTENT[kind];
  const attendee = booking.attendees[0];
  const eventTitle = booking.eventType?.title ?? booking.title;
  const date = `${formatTime(booking.startTime, recipient.timeZone, recipient.locale)} - ${formatTime(booking.endTime, recipient.timeZone, recipient.locale)}, ${formatLongDate(booking.startTime, recipient.timeZone, recipient.locale)}`;
  const subject = t(content.subjectKey, {
    eventType: eventTitle,
    title: booking.title,
    name: kind.startsWith("attendee")
      ? (booking.organizer.name ?? booking.organizer.email)
      : (attendee?.name ?? ""),
    attendeeName: attendee?.name ?? "",
    date,
  });

  const notes = typeof booking.responses.notes === "string" ? booking.responses.notes : null;
  const rows: [string, string | null][] = [
    [t("what"), booking.title],
    [t("when"), `${date} (${recipient.timeZone})`],
    [
      t("who"),
      [
        `${booking.organizer.name ?? booking.organizer.email} - ${t("organizer")}`,
        ...booking.attendees.map((a) => `${a.name} <${a.email}>`),
      ].join("\n"),
    ],
    [t("where"), booking.location],
    [t("additional_notes"), notes],
    [t("cancellation_reason"), kind.endsWith("cancelled") ? booking.cancellationReason : null],
  ];
  const visible = rows.filter((row): row is [string, string] => Boolean(row[1]));
  const action =
    kind === "organizer_requested"
      ? t("confirm_or_reject_request")
      : content.showManageLinks
        ? t("manage_this_event")
        : null;

  const text = [
    t(content.headingKey),
    "",
    ...visible.map(([label, value]) => `${label}: ${value}`),
    ...(action ? ["", `${action}: ${manageUrl}`] : []),
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:system-ui,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px"><h1 style="margin:0 0 24px;font-size:20px">${htmlEscape(t(content.headingKey))}</h1>
${visible
  .map(
    ([label, value]) =>
      `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">${htmlEscape(label)}</p><p style="margin:0 0 16px;font-size:15px;white-space:pre-line">${htmlEscape(value)}</p>`
  )
  .join("\n")}
${action ? `<p style="margin:24px 0 0"><a href="${htmlEscape(manageUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">${htmlEscape(action)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}
