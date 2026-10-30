import { fieldLabel, formatResponse, userFieldAnswers } from "~/lib/booking-fields";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import type { Messages, TFunction } from "~/lib/i18n";
import { createT } from "~/lib/i18n";
import { RECURRING_MESSAGE_KEYS, recurringSummary } from "~/lib/recurring";
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
  | "organizer_cancelled"
  | "attendee_guests_added"
  | "organizer_guests_added"
  | "attendee_location_changed"
  | "organizer_location_changed"
  | "attendee_reschedule_requested"
  | "organizer_reschedule_requested";

type Content = {
  subjectKey: string;
  headingKey: string;
  showManageLinks: boolean;
  /** Replaces "manage this event" as the button's label. */
  actionKey?: string;
  subtitleKey?: string;
};

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
  attendee_guests_added: {
    subjectKey: "guests_added_event_type_subject",
    headingKey: "new_guests_added",
    showManageLinks: true,
  },
  organizer_guests_added: {
    subjectKey: "guests_added_event_type_subject",
    headingKey: "new_guests_added",
    showManageLinks: true,
  },
  attendee_location_changed: {
    subjectKey: "location_changed_event_type_subject",
    headingKey: "event_location_changed",
    showManageLinks: true,
  },
  organizer_location_changed: {
    subjectKey: "location_changed_event_type_subject",
    headingKey: "event_location_changed",
    showManageLinks: true,
  },
  attendee_reschedule_requested: {
    subjectKey: "requested_to_reschedule_subject_attendee",
    headingKey: "request_reschedule_booking",
    subtitleKey: "request_reschedule_subtitle",
    actionKey: "book_a_new_time",
    showManageLinks: true,
  },
  organizer_reschedule_requested: {
    subjectKey: "request_reschedule_title_organizer",
    headingKey: "request_reschedule_title_organizer",
    showManageLinks: false,
  },
};

// Cal's headings for the first email about a recurring booking.
const RECURRING_HEADINGS: Partial<Record<EmailKind, string>> = {
  attendee_scheduled: "your_event_has_been_scheduled_recurring",
  attendee_requested: "booking_submitted_recurring",
  attendee_rejected: "event_request_declined_recurring",
  organizer_scheduled: "new_event_scheduled_recurring",
  organizer_requested: "event_awaiting_approval_recurring",
};

export const EMAIL_MESSAGE_KEYS = [
  ...new Set(
    Object.values(CONTENT).flatMap((c) => [
      c.subjectKey,
      c.headingKey,
      c.actionKey ?? "",
      c.subtitleKey ?? "",
    ])
  ),
  ...Object.values(RECURRING_HEADINGS),
  ...RECURRING_MESSAGE_KEYS,
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
  "reason_for_reschedule",
  "reason_for_reschedule_request",
  "yes",
  "no",
];

function emailAction(kind: EmailKind, content: Content, t: TFunction): string | null {
  if (kind === "organizer_requested") return t("confirm_or_reject_request");
  if (!content.showManageLinks) return null;
  return t(content.actionKey ?? "manage_this_event");
}

export function renderBookingEmail(
  kind: EmailKind,
  booking: BookingSnapshot,
  recipient: { timeZone: string; locale: string },
  messages: Messages,
  manageUrl: string
): { subject: string; html: string; text: string } {
  const t = createT(messages, recipient.locale);
  const content = {
    ...CONTENT[kind],
    headingKey: (booking.recurring && RECURRING_HEADINGS[kind]) || CONTENT[kind].headingKey,
  };
  const attendee = booking.attendees[0];
  const eventTitle = booking.eventType?.title ?? booking.title;
  const date = `${formatTime(booking.startTime, recipient.timeZone, recipient.locale)} - ${formatTime(booking.endTime, recipient.timeZone, recipient.locale)}, ${formatLongDate(booking.startTime, recipient.timeZone, recipient.locale)}`;
  const organizerName = booking.organizer.name ?? booking.organizer.email;
  const values = {
    eventType: eventTitle,
    title: booking.title,
    name: kind.startsWith("attendee") ? organizerName : (attendee?.name ?? ""),
    attendeeName: attendee?.name ?? "",
    attendee: attendee?.name || attendee?.email || "",
    organizer: organizerName,
    date,
  };
  const subject = t(content.subjectKey, values);
  const heading = t(content.headingKey, values);
  const subtitle = content.subtitleKey ? t(content.subtitleKey, values) : null;

  const notes = typeof booking.responses.notes === "string" ? booking.responses.notes : null;
  const rows: [string, string | null][] = [
    [t("what"), booking.title],
    [
      t("when"),
      [`${date} (${recipient.timeZone})`, booking.recurring ? recurringSummary(booking.recurring, t) : null]
        .filter(Boolean)
        .join("\n"),
    ],
    [
      t("who"),
      [
        `${booking.organizer.name ?? booking.organizer.email} - ${t("organizer")}`,
        ...booking.attendees.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)),
      ].join("\n"),
    ],
    [t("where"), booking.location],
    [t("additional_notes"), notes],
    ...userFieldAnswers(booking.bookingFields ?? [], booking.responses).map(
      ({ field, value }): [string, string] => [fieldLabel(field, t), formatResponse(value, t)]
    ),
    [
      t("reason_for_reschedule"),
      kind.endsWith("rescheduled") && typeof booking.responses.rescheduleReason === "string"
        ? booking.responses.rescheduleReason
        : null,
    ],
    [t("cancellation_reason"), kind.endsWith("cancelled") ? booking.cancellationReason : null],
    [
      t("reason_for_reschedule_request"),
      kind.endsWith("reschedule_requested") ? booking.cancellationReason : null,
    ],
  ];
  const visible = rows.filter((row): row is [string, string] => Boolean(row[1]));
  const action = emailAction(kind, content, t);

  const text = [
    heading,
    ...(subtitle ? ["", subtitle] : []),
    "",
    ...visible.map(([label, value]) => `${label}: ${value}`),
    ...(action ? ["", `${action}: ${manageUrl}`] : []),
  ].join("\n");
  const html = emailLayout(
    heading,
    `${subtitle ? emailParagraph(subtitle) : ""}${visible
      .map(
        ([label, value]) =>
          `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">${htmlEscape(label)}</p><p style="margin:0 0 16px;font-size:15px;white-space:pre-line">${htmlEscape(value)}</p>`
      )
      .join("\n")}${action ? emailButton(action, manageUrl) : ""}`
  );
  return { subject, html, text };
}

export type AuthEmailKind = "reset_password" | "verify_email" | "team_invite";

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
  "user_invited_you",
  "team",
  "team_invite_received",
  "email_no_user_invite_subheading",
  "accept_invitation",
];

type AuthEmailContent = {
  subject: string;
  heading: string;
  lines: string[];
  button: string;
  after: string[];
};

/** Cal's team invite email: who invited you to which team. */
function teamInviteContent(t: TFunction, values: Record<string, string>, appName: string): AuthEmailContent {
  const inviter = values.inviter ?? "";
  const team = values.team ?? "";
  return {
    subject: t("user_invited_you", { user: inviter, entity: t("team").toLowerCase(), team, appName }),
    heading: t("team_invite_received", { teamName: team }),
    lines: [t("email_no_user_invite_subheading", { invitedBy: inviter, appName })],
    button: t("accept_invitation"),
    after: [],
  };
}

export function renderAuthEmail(
  kind: AuthEmailKind,
  recipient: { name: string | null },
  url: string,
  messages: Messages,
  values: Record<string, string> = {}
): { subject: string; html: string; text: string } {
  const t = createT(messages);
  const greeting = t("hi_user_name", { name: recipient.name ?? "" }).trim();
  const appName = "Cal.diy";
  if (kind === "team_invite") return authEmailHtml(teamInviteContent(t, values, appName), url);
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
  return authEmailHtml(content, url);
}

function authEmailHtml(content: AuthEmailContent, url: string) {
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

export const CODE_EMAIL_MESSAGE_KEYS = [
  "verify_email_subject_verifying_email",
  "verify_email_email_header",
  "verify_email_by_code_email_body",
  "happy_scheduling",
];

/** A one-time code a booker types into the booking page (Cal's booker email verification). */
export function renderCodeEmail(
  code: string,
  messages: Messages
): { subject: string; html: string; text: string } {
  const t = createT(messages);
  const subject = t("verify_email_subject_verifying_email", { appName: "Cal.diy" });
  const body = t("verify_email_by_code_email_body");
  const html = emailLayout(
    t("verify_email_email_header"),
    [
      emailParagraph(body),
      `<p style="margin:16px 0;font-size:28px;font-weight:600;letter-spacing:6px">${htmlEscape(code)}</p>`,
      emailParagraph(t("happy_scheduling")),
    ].join("\n")
  );
  return { subject, html, text: [body, "", code, "", t("happy_scheduling")].join("\n") };
}
