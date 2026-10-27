import { describe, expect, it, vi } from "vitest";
import { withSystemFields } from "~/lib/booking-fields";
import type { BookingSnapshot } from "../bookings/events";
import { pickMessages } from "../catalog";
import { EmailService } from "./EmailService";
import { buildIcs } from "./ics";
import { createResendSender, type EmailMessage } from "./sender";
import {
  AUTH_EMAIL_MESSAGE_KEYS,
  EMAIL_MESSAGE_KEYS,
  renderAuthEmail,
  renderBookingEmail,
} from "./templates";

const booking: BookingSnapshot = {
  id: 1,
  uid: "uid-1",
  title: "Intro between Hana and Greta",
  description: null,
  startTime: new Date("2030-01-07T15:00:00Z"),
  endTime: new Date("2030-01-07T15:30:00Z"),
  status: "ACCEPTED",
  location: "Room 1; Floor 2, Building A",
  responses: { notes: "<b>bring slides</b>" },
  cancellationReason: null,
  fromReschedule: null,
  bookingFields: null,
  recurring: null,
  eventType: { id: 1, title: "Intro", slug: "intro", length: 30 },
  organizer: {
    id: 7,
    name: "Hana",
    email: "hana@example.com",
    username: "hana",
    timeZone: "America/New_York",
    locale: "en",
  },
  attendees: [
    { name: "Greta", email: "greta@example.com", timeZone: "Europe/Berlin", phoneNumber: null, locale: "de" },
  ],
};

describe("buildIcs", () => {
  it("produces an escaped, folded iCalendar invite with a stable UID", () => {
    const ics = buildIcs(
      { ...booking, title: "A".repeat(100) },
      { method: "REQUEST", sequence: 0, manageUrl: "https://cal.test/booking/uid-1" }
    );
    expect(ics).toContain("METHOD:REQUEST\r\n");
    expect(ics).toContain("UID:uid-1@cal.diy\r\n");
    expect(ics).toContain("DTSTART:20300107T150000Z\r\n");
    expect(ics).toContain("LOCATION:Room 1; Floor 2\\, Building A\r\n");
    expect(ics).toContain("ATTENDEE;CN=Greta;RSVP=TRUE:mailto:greta@example.com\r\n");
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
  });

  it("keeps the original UID across reschedules and marks cancellations", () => {
    const ics = buildIcs(
      { ...booking, uid: "new", fromReschedule: "uid-1" },
      { method: "CANCEL", sequence: 1, manageUrl: "x" }
    );
    expect(ics).toContain("UID:uid-1@cal.diy");
    expect(ics).toContain("STATUS:CANCELLED");
  });
});

describe("renderBookingEmail", () => {
  it("localizes the subject and times for the recipient and escapes user input", async () => {
    const messages = await pickMessages("de", EMAIL_MESSAGE_KEYS);
    const email = renderBookingEmail(
      "attendee_scheduled",
      booking,
      { timeZone: "Europe/Berlin", locale: "de" },
      messages,
      "https://cal.test/booking/uid-1"
    );
    expect(email.subject).toMatch(/Intro/);
    expect(email.subject).toContain("16:00"); // 15:00 UTC in Berlin
    expect(email.subject).not.toBe(
      renderBookingEmail(
        "attendee_scheduled",
        booking,
        { timeZone: "Europe/Berlin", locale: "en" },
        await pickMessages("en", EMAIL_MESSAGE_KEYS),
        "x"
      ).subject
    );
    expect(email.html).toContain("&lt;b&gt;bring slides&lt;/b&gt;");
    expect(email.html).toContain("https://cal.test/booking/uid-1");
    expect(email.text).toContain("bring slides");
  });

  it("lists the host's questions with their answers, and the reason on reschedules", async () => {
    const withAnswers: BookingSnapshot = {
      ...booking,
      responses: { notes: "Hi", company: "<Acme>", newsletter: true, rescheduleReason: "Clash" },
      bookingFields: withSystemFields([
        { name: "company", type: "text", label: "Company", editable: "user" },
        { name: "newsletter", type: "boolean", label: "Newsletter", editable: "user" },
      ]),
    };
    const messages = await pickMessages("en", EMAIL_MESSAGE_KEYS);
    const scheduled = renderBookingEmail(
      "organizer_scheduled",
      withAnswers,
      booking.organizer,
      messages,
      "x"
    );
    expect(scheduled.text).toContain("Company: <Acme>");
    expect(scheduled.text).toContain("Newsletter: Yes");
    expect(scheduled.html).toContain("&lt;Acme&gt;");
    expect(scheduled.text).not.toContain("Clash");
    const moved = renderBookingEmail("organizer_rescheduled", withAnswers, booking.organizer, messages, "x");
    expect(moved.text).toContain("Reason for reschedule: Clash");
  });
});

describe("renderAuthEmail", () => {
  it("renders a localized reset email with the link and an escaped name", async () => {
    const email = renderAuthEmail(
      "reset_password",
      { name: "<Greta>" },
      "https://cal.test/api/auth/reset-password/tok?callbackURL=%2Fauth%2Freset-password",
      await pickMessages("en", AUTH_EMAIL_MESSAGE_KEYS)
    );
    expect(email.subject).toBe("Cal.diy: Reset password instructions");
    expect(email.html).toContain("Hi &lt;Greta&gt;");
    expect(email.html).toContain(
      'href="https://cal.test/api/auth/reset-password/tok?callbackURL=%2Fauth%2Freset-password"'
    );
    expect(email.text).toContain("https://cal.test/api/auth/reset-password/tok");
  });

  it("translates the verification email", async () => {
    const english = renderAuthEmail(
      "verify_email",
      { name: null },
      "https://cal.test/v",
      await pickMessages("en", AUTH_EMAIL_MESSAGE_KEYS)
    );
    const german = renderAuthEmail(
      "verify_email",
      { name: null },
      "https://cal.test/v",
      await pickMessages("de", AUTH_EMAIL_MESSAGE_KEYS)
    );
    expect(english.subject).toBe("Cal.diy: Verify your account");
    expect(german.subject).not.toBe(english.subject);
    expect(german.html).toContain("https://cal.test/v");
  });
});

describe("EmailService", () => {
  const service = (send: (m: EmailMessage) => Promise<void>) =>
    new EmailService({
      send,
      from: "Cal.diy <no-reply@cal.test>",
      publicUrl: "https://cal.test",
      loadMessages: pickMessages,
    });

  it("emails each attendee and the organizer about a new booking, with an invite attached", async () => {
    const sent: EmailMessage[] = [];
    await service(async (m) => void sent.push(m)).onBookingEvent({ type: "BOOKING_CREATED", booking });
    expect(sent.map((m) => [m.to, m.replyTo])).toEqual([
      ["greta@example.com", "hana@example.com"],
      ["hana@example.com", "greta@example.com"],
    ]);
    expect(sent[0].attachments?.[0]).toMatchObject({
      filename: "invite.ics",
      contentType: "text/calendar; method=REQUEST",
    });
  });

  it("hides the organizer's address from attendees when the event type says so", async () => {
    const sent: EmailMessage[] = [];
    const hidden = {
      ...booking,
      eventType: { ...booking.eventType, id: 1, hideOrganizerEmail: true },
    } as BookingSnapshot;
    await service(async (m) => void sent.push(m)).onBookingEvent({
      type: "BOOKING_CREATED",
      booking: hidden,
    });
    expect(sent[0]).toMatchObject({ to: "greta@example.com", replyTo: undefined });
    const ics = String(sent[0].attachments?.[0]?.content);
    expect(ics).toContain("mailto:no-reply@cal.test");
    expect(ics).not.toContain("hana@example.com");
  });

  it("leaves confirmations to workflows when standard confirmation emails are off", async () => {
    const sent: EmailMessage[] = [];
    const quiet = {
      ...booking,
      eventType: { ...booking.eventType, id: 1, disableConfirmationEmails: { host: false, attendee: true } },
    } as BookingSnapshot;
    const emails = service(async (m) => void sent.push(m));
    await emails.onBookingEvent({ type: "BOOKING_CREATED", booking: quiet });
    expect(sent.map((m) => m.to)).toEqual(["hana@example.com"]);
    await emails.onBookingEvent({ type: "BOOKING_CANCELLED", booking: quiet });
    expect(sent.map((m) => m.to)).toContain("greta@example.com");
  });

  it("emails once per recurring series, with the series in the heading and times", async () => {
    const sent: EmailMessage[] = [];
    const emails = service(async (m) => void sent.push(m));
    const series = { ...booking, recurring: { freq: 2, interval: 1, count: 3 } };
    await emails.onBookingEvent({ type: "BOOKING_CREATED", booking: series, seriesIndex: 1 });
    expect(sent).toHaveLength(0);
    await emails.onBookingEvent({ type: "BOOKING_CREATED", booking: series, seriesIndex: 0 });
    expect(sent[1].text).toContain("A new recurring event has been scheduled.");
    expect(sent[1].text).toContain("Every week for 3 occurrences");
  });

  it("tells only the booker whose seat changed, and the organizer", async () => {
    const sent: EmailMessage[] = [];
    const seated = {
      ...booking,
      attendees: [
        ...booking.attendees,
        { name: "Sam", email: "sam@example.com", timeZone: "UTC", phoneNumber: null, locale: "en" },
      ],
    };
    await service(async (m) => void sent.push(m)).onBookingEvent({
      type: "BOOKING_CREATED",
      booking: seated,
      seat: { referenceUid: "seat-1", attendeeEmail: "sam@example.com" },
    });
    expect(sent.map((m) => m.to)).toEqual(["sam@example.com", "hana@example.com"]);
  });

  it("only tells the attendee about a rejection, and sends cancellations as CANCEL", async () => {
    const sent: EmailMessage[] = [];
    const svc = service(async (m) => void sent.push(m));
    await svc.onBookingEvent({ type: "BOOKING_REJECTED", booking });
    expect(sent.map((m) => m.to)).toEqual(["greta@example.com"]);
    sent.length = 0;
    await svc.onBookingEvent({ type: "BOOKING_CANCELLED", booking });
    expect(sent.every((m) => m.attachments?.[0].contentType === "text/calendar; method=CANCEL")).toBe(true);
  });

  it("sends the organizer to the approvals list for requests, and survives a failing send", async () => {
    const sent: EmailMessage[] = [];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await service(async (m) => {
      if (m.to === "greta@example.com") throw new Error("smtp down");
      sent.push(m);
    }).onBookingEvent({ type: "BOOKING_REQUESTED", booking });
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("https://cal.test/bookings/unconfirmed");
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("confirms the booking to new guests and updates everyone else", async () => {
    const sent: EmailMessage[] = [];
    const withGuest = {
      ...booking,
      attendees: [
        ...booking.attendees,
        { name: "", email: "nina@example.com", timeZone: "UTC", phoneNumber: null, locale: "en" },
      ],
    };
    await service(async (m) => void sent.push(m)).onBookingEvent({
      type: "BOOKING_GUESTS_ADDED",
      booking: withGuest,
      guestsAdded: ["nina@example.com"],
    });
    expect(sent.map((m) => [m.to, m.subject.split(":")[0]])).toEqual([
      ["greta@example.com", "Gäste hinzugefügt"],
      ["nina@example.com", "Confirmed"],
      ["hana@example.com", "Guests Added"],
    ]);
  });

  it("asks attendees to book a new time with a link back to the booker", async () => {
    const sent: EmailMessage[] = [];
    await service(async (m) => void sent.push(m)).onBookingEvent({
      type: "BOOKING_CANCELLED",
      booking: { ...booking, status: "CANCELLED", cancellationReason: "Double-booked" },
      rescheduleRequested: true,
    });
    const [attendee, organizer] = sent;
    expect(attendee.html).toContain("https://cal.test/hana/intro?rescheduleUid=uid-1");
    expect(attendee.html).toContain("Double-booked");
    expect(attendee.attachments?.[0].contentType).toBe("text/calendar; method=CANCEL");
    expect(organizer.subject).toBe("You have requested Greta to reschedule");
  });
});

describe("createResendSender", () => {
  it("posts to Resend with base64 attachments", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    await createResendSender(
      "re_key",
      fetchMock as unknown as typeof fetch
    )({
      from: "a@x.test",
      to: "b@x.test",
      subject: "S",
      html: "<p>H</p>",
      text: "H",
      attachments: [{ filename: "invite.ics", content: "BEGIN:VCALENDAR", contentType: "text/calendar" }],
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_key" });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ to: ["b@x.test"], subject: "S" });
    expect(atob(body.attachments[0].content)).toBe("BEGIN:VCALENDAR");
  });
});
