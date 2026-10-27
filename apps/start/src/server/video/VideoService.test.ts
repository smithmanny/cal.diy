import type { Database } from "@calcom/db/database";
import { booking, bookingReference, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { CredentialRepository } from "../apps/CredentialRepository";
import { CredentialVault } from "../apps/CredentialVault";
import { createFakeAppsState, FAKE_APP_PATHS, type FakeAppsState, fakeAppsFetch } from "../apps/fakeApps";
import type { OAuthClientConfig } from "../apps/oauth";
import type { BookingEvent, BookingSnapshot } from "../bookings/events";
import { dailyProvider, jitsiProvider, zoomMeetingBody, zoomProvider } from "./providers";
import { VideoRepository } from "./VideoRepository";
import { VideoService } from "./VideoService";

const ORIGIN = "https://apps.test";
const KEY = "0123456789abcdef0123456789abcdef";
const zoomOAuth: OAuthClientConfig = {
  clientId: "z",
  clientSecret: "s",
  redirectUri: "https://cal.test/cb",
  authorizeUrl: `${ORIGIN}${FAKE_APP_PATHS.zoomOAuth}/authorize`,
  tokenUrl: `${ORIGIN}${FAKE_APP_PATHS.zoomOAuth}/token`,
  scopes: [],
  clientAuth: "basic",
  expiryUnit: "ms",
};

let db: Database;
let fake: FakeAppsState;
let video: VideoService;
let hostId: number;

function snapshot(uid: string, location: string): BookingSnapshot {
  return {
    uid,
    title: "Intro between Hana and Greta",
    description: null,
    startTime: new Date("2030-01-07T12:00:00Z"),
    endTime: new Date("2030-01-07T12:30:00Z"),
    status: "ACCEPTED",
    location,
    responses: {},
    id: 1,
    cancelledBy: null,
    rejectionReason: null,
    cancellationReason: null,
    fromReschedule: null,
    eventType: { id: 1, title: "Intro", slug: "intro", length: 30 },
    recurring: null,
    bookingFields: null,
    organizer: {
      id: hostId,
      name: "Hana",
      email: "host@example.com",
      username: "host",
      timeZone: "UTC",
      locale: "en",
    },
    attendees: [
      { name: "Greta", email: "greta@example.com", timeZone: "UTC", phoneNumber: null, locale: null },
    ],
  };
}

async function insertBooking(uid: string, location: string) {
  await db.insert(booking).values({
    uid,
    title: "Intro",
    startTime: new Date("2030-01-07T12:00:00Z"),
    endTime: new Date("2030-01-07T12:30:00Z"),
    userId: hostId,
    location,
  });
  return snapshot(uid, location);
}

beforeEach(async () => {
  db = await createTestDb();
  fake = createFakeAppsState();
  const fetchImpl = fakeAppsFetch(fake, ORIGIN);
  video = new VideoService(new VideoRepository(db), new CredentialRepository(db), {
    providers: [
      zoomProvider(zoomOAuth, `${ORIGIN}${FAKE_APP_PATHS.zoomApi}`, fetchImpl),
      dailyProvider("daily-key", `${ORIGIN}${FAKE_APP_PATHS.dailyApi}`, "https://cal.test", fetchImpl),
      jitsiProvider("https://meet.jit.si/cal"),
    ],
    vault: new CredentialVault(KEY),
  });
  [{ id: hostId }] = await db
    .insert(user)
    .values({ email: "host@example.com", username: "host", name: "Hana", timeZone: "UTC" })
    .returning({ id: user.id });
});

describe("VideoService", () => {
  it("creates a Zoom meeting with the host's credential and puts its link on the booking", async () => {
    await video.connectOAuth(hostId, "zoom_video", "code");
    const event: BookingEvent = {
      type: "BOOKING_CREATED",
      booking: await insertBooking("b-1", "integrations:zoom"),
    };
    await video.onBookingEvent(event);

    expect(event.booking.location).toMatch(/^https:\/\/zoom\.us\/j\/\d+/);
    const [stored] = await db
      .select({ location: booking.location, metadata: booking.metadata })
      .from(booking)
      .where(eq(booking.uid, "b-1"));
    expect(stored).toEqual({
      location: event.booking.location,
      metadata: { videoCallUrl: event.booking.location },
    });
    const [reference] = await db.select().from(bookingReference);
    expect(reference).toMatchObject({
      type: "zoom_video",
      meetingPassword: "fake",
      meetingUrl: event.booking.location,
    });

    await video.onBookingEvent({ type: "BOOKING_CANCELLED", booking: event.booking });
    expect(fake.meetings.size).toBe(0);
    expect((await db.select({ deleted: bookingReference.deleted }).from(bookingReference))[0].deleted).toBe(
      true
    );
  });

  it("skips a Zoom location when the host hasn't installed Zoom", async () => {
    const event: BookingEvent = {
      type: "BOOKING_CREATED",
      booking: await insertBooking("b-2", "integrations:zoom"),
    };
    await video.onBookingEvent(event);
    expect(event.booking.location).toBe("integrations:zoom");
    expect(fake.meetings.size).toBe(0);
  });

  it("gives Cal Video bookings a /video link to a Daily room, and one room for every seat", async () => {
    const created = await insertBooking("b-3", "integrations:daily");
    await video.onBookingEvent({ type: "BOOKING_CREATED", booking: created });
    expect(created.location).toBe("https://cal.test/video/b-3");
    expect(await video.roomUrl("b-3", "daily_video")).toMatch(/^https:\/\/cal\.daily\.co\/room-/);

    await video.onBookingEvent({
      type: "BOOKING_CREATED",
      booking: snapshot("b-3", "integrations:daily"),
      seat: { referenceUid: "seat-2", attendeeEmail: "second@example.com" },
    });
    expect(fake.meetings.size).toBe(1);
  });

  it("moves the meeting when the booking is rescheduled", async () => {
    const first = await insertBooking("b-4", "integrations:jitsi");
    await new CredentialRepository(db).create(hostId, "jitsi_video", null);
    await video.onBookingEvent({ type: "BOOKING_CREATED", booking: first });
    const moved = await insertBooking("b-5", "integrations:jitsi");
    await video.onBookingEvent({ type: "BOOKING_RESCHEDULED", booking: moved, rescheduledFrom: first });

    expect(moved.location).toMatch(/^https:\/\/meet\.jit\.si\/cal\/[0-9a-f-]{36}$/);
    expect(moved.location).not.toBe(first.location);
    const references = await db.select({ deleted: bookingReference.deleted }).from(bookingReference);
    expect(references.map((reference) => reference.deleted)).toEqual([true, null]);
  });

  it("replaces the meeting when the host changes the location, and removes it when moved off video", async () => {
    await new CredentialRepository(db).create(hostId, "jitsi_video", null);
    const created = await insertBooking("b-7", "integrations:daily");
    await video.onBookingEvent({ type: "BOOKING_CREATED", booking: created });
    const toJitsi = snapshot("b-7", "integrations:jitsi");
    await video.onBookingEvent({
      type: "BOOKING_LOCATION_CHANGED",
      booking: toJitsi,
      previousLocation: created.location,
    });
    expect(fake.meetings.size).toBe(0);
    expect(toJitsi.location).toMatch(/^https:\/\/meet\.jit\.si\/cal\//);

    await video.onBookingEvent({
      type: "BOOKING_LOCATION_CHANGED",
      booking: snapshot("b-7", "Office"),
      previousLocation: toJitsi.location,
    });
    const live = await db.select({ deleted: bookingReference.deleted }).from(bookingReference);
    expect(live.every((reference) => reference.deleted)).toBe(true);
  });

  it("leaves other locations alone", async () => {
    const event: BookingEvent = { type: "BOOKING_CREATED", booking: await insertBooking("b-6", "Room 1") };
    await video.onBookingEvent(event);
    expect(event.booking.location).toBe("Room 1");
    expect(fake.calls).toEqual([]);
  });
});

describe("zoomMeetingBody", () => {
  it("schedules the meeting in UTC with its length and a capped agenda", () => {
    const body = zoomMeetingBody({
      uid: "b",
      title: "Intro",
      description: "x".repeat(3000),
      start: new Date("2030-01-07T12:00:00Z"),
      end: new Date("2030-01-07T12:45:00Z"),
      timeZone: "Europe/Berlin",
      attendees: [],
    });
    expect(body).toMatchObject({ topic: "Intro", type: 2, start_time: "2030-01-07T12:00:00Z", duration: 45 });
    expect(body.agenda.length).toBeLessThanOrEqual(1903);
  });
});
