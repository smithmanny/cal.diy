import { formatLongDate, formatTime } from "~/lib/date-utils";
import type { Messages } from "~/lib/i18n";
import { createT } from "~/lib/i18n";
import type { BookingSnapshot } from "../bookings/events";
import { emailButton, emailLayout, emailParagraph, htmlEscape } from "./layout";

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
  const html = emailLayout(
    t(content.headingKey),
    `${visible
      .map(
        ([label, value]) =>
          `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">${htmlEscape(label)}</p><p style="margin:0 0 16px;font-size:15px;white-space:pre-line">${htmlEscape(value)}</p>`
      )
      .join("\n")}${action ? emailButton(action, manageUrl) : ""}`
  );
  return { subject, html, text };
}

export type AuthEmailKind = "reset_password" | "verify_email";

export const AUTH_EMAIL_MESSAGE_KEYS = [
  "hi_user_name",
  "reset_password_subject",
  "someone_requested_password_reset",
  "change_password",
  "password_reset_instructions",
  "verify_email_subject",
  "verify_email_email_header",
  "verify_email_email_body",
  "verify_email_button",
  "verify_email_email_link_text",
  "happy_scheduling",
];

export function renderAuthEmail(
  kind: AuthEmailKind,
  recipient: { name: string | null },
  url: string,
  messages: Messages
): { subject: string; html: string; text: string } {
  const t = createT(messages);
  const greeting = t("hi_user_name", { name: recipient.name ?? "" }).trim();
  const appName = "Cal.diy";
  const content =
    kind === "reset_password"
      ? {
          subject: t("reset_password_subject", { appName }),
          heading: t("change_password"),
          lines: [greeting, t("someone_requested_password_reset")],
          button: t("change_password"),
          after: [t("password_reset_instructions")],
        }
      : {
          subject: t("verify_email_subject", { appName }),
          heading: t("verify_email_email_header"),
          lines: [greeting, t("verify_email_email_body")],
          button: t("verify_email_button"),
          after: [t("verify_email_email_link_text"), url, t("happy_scheduling")],
        };
  const html = emailLayout(
    content.heading,
    [
      ...content.lines.map(emailParagraph),
      emailButton(content.button, url),
      `<div style="margin-top:24px">${content.after.map(emailParagraph).join("")}</div>`,
    ].join("\n")
  );
  const text = [...content.lines, "", `${content.button}: ${url}`, "", ...content.after].join("\n");
  return { subject: content.subject, html, text };
}
