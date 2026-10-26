import dayjs from "@calcom/dayjs";
import type { BookingEvent, BookingSnapshot } from "../bookings/events";

function utcOffset(timeZone: string, at: Date): number {
  try {
    return dayjs(at).tz(timeZone).utcOffset();
  } catch {
    return 0;
  }
}

function lookup(data: unknown, path: string): unknown {
  let node: unknown = data;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export const WEBHOOK_VERSION = "2021-10-20";

/** Cal's CalendarEvent-shaped webhook payload, so existing integrations keep working. */
export function buildBookingPayload(booking: BookingSnapshot, extra: Record<string, unknown> = {}) {
  const notes = typeof booking.responses.notes === "string" ? booking.responses.notes : null;
  return {
    type: booking.eventType?.slug ?? null,
    title: booking.title,
    description: booking.description ?? notes,
    additionalNotes: notes,
    customInputs: {},
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    organizer: {
      id: booking.organizer.id,
      name: booking.organizer.name,
      email: booking.organizer.email,
      username: booking.organizer.username,
      timeZone: booking.organizer.timeZone,
      language: { locale: booking.organizer.locale },
      utcOffset: utcOffset(booking.organizer.timeZone, booking.startTime),
    },
    responses: booking.responses,
    userFieldsResponses: {},
    attendees: booking.attendees.map((attendee) => ({
      name: attendee.name,
      email: attendee.email,
      timeZone: attendee.timeZone,
      phoneNumber: attendee.phoneNumber,
      language: { locale: attendee.locale ?? "en" },
      utcOffset: utcOffset(attendee.timeZone, booking.startTime),
    })),
    location: booking.location,
    uid: booking.uid,
    eventTitle: booking.eventType?.title ?? null,
    eventDescription: null,
    requiresConfirmation: booking.status === "PENDING",
    price: 0,
    currency: "usd",
    length:
      booking.eventType?.length ??
      Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / 60000),
    status: booking.status,
    cancellationReason: booking.cancellationReason,
    metadata: {},
    ...extra,
  };
}

export function payloadForEvent(event: BookingEvent) {
  if (event.type !== "BOOKING_RESCHEDULED" || !event.rescheduledFrom)
    return buildBookingPayload(event.booking);
  return buildBookingPayload(event.booking, {
    rescheduleUid: event.rescheduledFrom.uid,
    rescheduleStartTime: event.rescheduledFrom.startTime.toISOString(),
    rescheduleEndTime: event.rescheduledFrom.endTime.toISOString(),
  });
}

/**
 * Fills `{{path.to.value}}` placeholders. Cal compiled templates with Handlebars, which needs
 * `new Function` (forbidden on Workers), so only plain variables are supported, not block helpers.
 */
export function renderTemplate(template: string, data: unknown, escapeJson: boolean): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = lookup(data, path);
    if (value === undefined || value === null) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    // Inside a JSON template a value lands between quotes, so it must be escaped like a JSON string.
    return escapeJson ? JSON.stringify(text).slice(1, -1) : text;
  });
}

export async function signBody(secret: string | null, body: string): Promise<string> {
  if (!secret) return "no-secret-provided";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type Subscriber = { subscriberUrl: string; secret: string | null; payloadTemplate: string | null };

/** Builds the request exactly as Cal sends it (body shape, content type, signature headers). */
export async function buildWebhookRequest(
  subscriber: Subscriber,
  triggerEvent: string,
  payload: Record<string, unknown>,
  createdAt = new Date().toISOString()
): Promise<Request> {
  const template = subscriber.payloadTemplate;
  // A template that isn't JSON (e.g. a form body) is sent form-encoded, as in Cal.
  const isJsonTemplate = Boolean(template && isJson(renderTemplate(template, {}, true)));
  const contentType = !template || isJsonTemplate ? "application/json" : "application/x-www-form-urlencoded";
  const body = template
    ? renderTemplate(template, { ...payload, triggerEvent, createdAt }, isJsonTemplate)
    : JSON.stringify({ triggerEvent, createdAt, payload });

  return new Request(subscriber.subscriberUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-Cal-Signature-256": await signBody(subscriber.secret, body),
      "X-Cal-Webhook-Version": WEBHOOK_VERSION,
    },
    redirect: "manual",
    body,
  });
}

export async function deliverWebhook(
  subscriber: Subscriber,
  triggerEvent: string,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; status: number }> {
  const request = await buildWebhookRequest(subscriber, triggerEvent, payload);
  const response = await fetchImpl(request, { signal: AbortSignal.timeout(10_000) });
  return { ok: response.ok, status: response.status };
}
