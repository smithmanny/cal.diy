import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withSystemFields } from "~/lib/booking-fields";
import type { BookingSnapshot } from "../bookings/events";
import {
  buildBookingPayload,
  buildWebhookRequest,
  payloadForEvent,
  renderTemplate,
  signBody,
} from "./payload";

const snapshot: BookingSnapshot = {
  id: 1,
  uid: "uid-1",
  title: "Intro between Hana and Greta",
  description: null,
  startTime: new Date("2030-01-07T10:00:00Z"),
  endTime: new Date("2030-01-07T10:30:00Z"),
  status: "ACCEPTED",
  location: "https://meet.example/x",
  responses: { name: "Greta", email: "greta@example.com", notes: "Hi", company: "Acme" },
  cancellationReason: null,
  fromReschedule: null,
  recurring: null,
  bookingFields: withSystemFields([
    { name: "company", type: "text", label: "Company", required: false, editable: "user" },
  ]),
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

describe("webhook payload", () => {
  it("matches Cal's CalendarEvent shape, with UTC offsets at the booking time", () => {
    expect(buildBookingPayload(snapshot)).toMatchObject({
      type: "intro",
      title: "Intro between Hana and Greta",
      description: "Hi",
      additionalNotes: "Hi",
      startTime: "2030-01-07T10:00:00.000Z",
      organizer: {
        email: "hana@example.com",
        timeZone: "America/New_York",
        utcOffset: -300,
        language: { locale: "en" },
      },
      attendees: [{ email: "greta@example.com", utcOffset: 60, language: { locale: "de" } }],
      uid: "uid-1",
      eventTitle: "Intro",
      length: 30,
      status: "ACCEPTED",
    });
  });

  it("labels answers like Cal, listing the host's own questions separately", () => {
    const payload = buildBookingPayload(snapshot);
    expect(payload.responses).toMatchObject({
      name: { label: "your_name", value: "Greta", isHidden: false },
      notes: { label: "additional_notes", value: "Hi" },
      company: { label: "Company", value: "Acme" },
    });
    expect(payload.userFieldsResponses).toEqual({
      company: { label: "Company", value: "Acme", isHidden: false },
    });
  });

  it("falls back to field names when the event type is gone", () => {
    const payload = buildBookingPayload({ ...snapshot, bookingFields: null });
    expect(payload.responses.company).toEqual({ label: "company", value: "Acme" });
    expect(Object.keys(payload.userFieldsResponses)).toEqual(["company"]);
  });

  it("names the seat that changed, like Cal's attendeeSeatId", () => {
    expect(
      payloadForEvent({
        type: "BOOKING_CREATED",
        booking: snapshot,
        seat: { referenceUid: "seat-1", attendeeEmail: "x" },
      })
    ).toMatchObject({ attendeeSeatId: "seat-1" });
  });

  it("adds the previous times on reschedules", () => {
    const payload = payloadForEvent({
      type: "BOOKING_RESCHEDULED",
      booking: snapshot,
      rescheduledFrom: {
        ...snapshot,
        uid: "old",
        startTime: new Date("2030-01-06T10:00:00Z"),
        endTime: new Date("2030-01-06T10:30:00Z"),
      },
    });
    expect(payload).toMatchObject({ rescheduleUid: "old", rescheduleStartTime: "2030-01-06T10:00:00.000Z" });
  });

  it("signs exactly like Cal (hex HMAC-SHA256 of the body)", async () => {
    const body = JSON.stringify({ a: 1 });
    expect(await signBody("s3cret", body)).toBe(createHmac("sha256", "s3cret").update(body).digest("hex"));
    expect(await signBody(null, body)).toBe("no-secret-provided");
  });

  it("renders variables and escapes them inside JSON templates", () => {
    const data = { title: 'Say "hi"', organizer: { name: "Hana" }, missing: null };
    expect(renderTemplate('{"t":"{{title}}","o":"{{organizer.name}}","m":"{{missing}}"}', data, true)).toBe(
      '{"t":"Say \\"hi\\"","o":"Hana","m":""}'
    );
    expect(renderTemplate("title={{title}}", data, false)).toBe('title=Say "hi"');
  });

  it("builds Cal's default request with headers and the triggerEvent envelope", async () => {
    const request = await buildWebhookRequest(
      { subscriberUrl: "https://hooks.example/cal", secret: "k", payloadTemplate: null },
      "BOOKING_CREATED",
      { uid: "uid-1" },
      "2030-01-01T00:00:00.000Z"
    );
    const body = await request.text();
    expect(JSON.parse(body)).toEqual({
      triggerEvent: "BOOKING_CREATED",
      createdAt: "2030-01-01T00:00:00.000Z",
      payload: { uid: "uid-1" },
    });
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("x-cal-webhook-version")).toBe("2021-10-20");
    expect(request.headers.get("x-cal-signature-256")).toBe(
      createHmac("sha256", "k").update(body).digest("hex")
    );
    expect(request.redirect).toBe("manual");
  });

  it("form-encodes non-JSON templates", async () => {
    const request = await buildWebhookRequest(
      {
        subscriberUrl: "https://hooks.example/cal",
        secret: null,
        payloadTemplate: "event={{triggerEvent}}&uid={{uid}}",
      },
      "BOOKING_CANCELLED",
      { uid: "uid-1" }
    );
    expect(request.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(await request.text()).toBe("event=BOOKING_CANCELLED&uid=uid-1");
  });
});

describe("payloadForEvent for BOOKING_NO_SHOW_UPDATED", () => {
  it("sends Cal's no-show change instead of the booking", () => {
    const attendees = [{ email: "greta@example.com", noShow: true }];
    expect(
      payloadForEvent({
        type: "BOOKING_NO_SHOW_UPDATED",
        booking: snapshot,
        noShow: { message: "greta@example.com marked as no-show", attendees },
      })
    ).toEqual({
      message: "greta@example.com marked as no-show",
      attendees,
      bookingUid: "uid-1",
      bookingId: 1,
    });
  });
});
