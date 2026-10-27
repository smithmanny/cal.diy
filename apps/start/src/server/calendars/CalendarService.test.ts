import type { Database } from "@calcom/db/database";
import { booking, bookingReference, credential, eventType, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { BookingRepository } from "../bookings/BookingRepository";
import { BookingService } from "../bookings/BookingService";
import { EventTypeRepository } from "../event-types/EventTypeRepository";
import { HolidayRepository } from "../holidays/HolidayRepository";
import { HolidayService } from "../holidays/HolidayService";
import { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { ScheduleService } from "../schedules/ScheduleService";
import { DEFAULT_WEEKLY_HOURS } from "../schedules/scheduleMapper";
import { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import { UserRepository } from "../users/UserRepository";
import { CalendarRepository } from "./CalendarRepository";
import { CalendarService } from "./CalendarService";
import { createFakeGoogle, FAKE_ENDPOINTS, type FakeGoogle } from "./google/fakeGoogle";

const KEY = "0123456789abcdef0123456789abcdef";
let db: Database;
let google: FakeGoogle;
let calendars: CalendarService;
let hostId: number;

function makeCalendarService(fake: FakeGoogle) {
  return new CalendarService(new CalendarRepository(db), {
    oauth: {
      clientId: "c",
      clientSecret: "s",
      redirectUri: "https://cal.test/cb",
      endpoints: FAKE_ENDPOINTS,
    },
    encryptionKey: KEY,
    publicUrl: "https://cal.test",
    fetchImpl: fake.fetch,
  });
}

beforeEach(async () => {
  db = await createTestDb();
  google = createFakeGoogle();
  calendars = makeCalendarService(google);
  [{ id: hostId }] = await db
    .insert(user)
    .values({ email: "host@example.com", username: "host", name: "Hana", timeZone: "UTC" })
    .returning({ id: user.id });
});

describe("CalendarService", () => {
  it("connects with encrypted tokens, checking and writing to the primary calendar", async () => {
    await calendars.connect(hostId, "auth-code");

    const [row] = await db
      .select({ key: credential.key, encryptedKey: credential.encryptedKey, type: credential.type })
      .from(credential);
    expect(row.type).toBe("google_calendar");
    expect(row.key).toEqual({});
    expect(row.encryptedKey).not.toContain("refresh-1");

    const [connection] = await calendars.listConnections(hostId);
    expect(connection.calendars).toEqual([
      { id: "me@example.com", name: "Me", primary: true, selected: true, destination: true },
      { id: "team@group", name: "Team", primary: false, selected: false, destination: false },
    ]);
  });

  it("refreshes expired tokens and stores the new ones", async () => {
    const expiring = createFakeGoogle({ expiresIn: 30 });
    const service = makeCalendarService(expiring);
    await service.connect(hostId, "code");
    const before = (await db.select({ encryptedKey: credential.encryptedKey }).from(credential))[0]
      .encryptedKey;
    await service.listConnections(hostId);
    expect(expiring.tokenRequests).toBe(3); // code exchange, then a refresh for each of two calls
    const after = (await db.select({ encryptedKey: credential.encryptedKey }).from(credential))[0]
      .encryptedKey;
    expect(after).not.toBe(before);
  });

  it("returns busy time only from selected calendars and ignores a broken connection", async () => {
    await calendars.connect(hostId, "code");
    google.busy = [{ start: "2030-01-07T10:00:00Z", end: "2030-01-07T11:00:00Z" }];
    const busy = await calendars.busyTimes(
      hostId,
      new Date("2030-01-07T00:00:00Z"),
      new Date("2030-01-08T00:00:00Z")
    );
    expect(busy).toEqual([
      { start: new Date("2030-01-07T10:00:00Z"), end: new Date("2030-01-07T11:00:00Z") },
    ]);
    const freeBusy = google.calls.find((call) => call.url.endsWith("/freeBusy"));
    expect((freeBusy?.body as { items: unknown[] }).items).toEqual([{ id: "me@example.com" }]);

    await db.update(credential).set({ encryptedKey: "00:bad" });
    await expect(calendars.busyTimes(hostId, new Date(), new Date())).resolves.toEqual([]);
  });

  it("enforces ownership on settings changes", async () => {
    await calendars.connect(hostId, "code");
    const [{ id: credentialId }] = await db.select({ id: credential.id }).from(credential);
    await expect(calendars.setSelected(hostId + 1, credentialId, "team@group", true)).rejects.toMatchObject({
      code: "not_found",
    });
    await calendars.setSelected(hostId, credentialId, "team@group", true);
    await calendars.setDestination(hostId, credentialId, "team@group");
    const [connection] = await calendars.listConnections(hostId);
    expect(connection.calendars.find((c) => c.id === "team@group")).toMatchObject({
      selected: true,
      destination: true,
    });
    await calendars.disconnect(hostId, credentialId);
    expect(await calendars.listConnections(hostId)).toEqual([]);
    expect(google.calls.some((call) => call.url.startsWith(FAKE_ENDPOINTS.revoke))).toBe(true);
  });
});

describe("Google Calendar in the booking flow", () => {
  let bookings: BookingService;
  let pending: Promise<unknown>[];

  beforeEach(async () => {
    pending = [];
    const userRepo = new UserRepository(db);
    const scheduleRepo = new ScheduleRepository(db);
    await new ScheduleService({ scheduleRepo, userRepo }).create(hostId, {
      name: "Work",
      timeZone: "UTC",
      weeklyHours: DEFAULT_WEEKLY_HOURS,
      dateOverrides: [],
    });
    await db.insert(eventType).values({
      userId: hostId,
      title: "Intro",
      slug: "intro",
      length: 60,
      minimumBookingNotice: 0,
      locations: [{ type: "integrations:google:meet" }],
    });
    await calendars.connect(hostId, "code");
    bookings = new BookingService({
      userRepo,
      eventTypeRepo: new EventTypeRepository(db),
      scheduleRepo,
      bookingRepo: new BookingRepository(db),
      travelScheduleRepo: new TravelScheduleRepository(db),
      oooRepo: new OutOfOfficeRepository(db),
      holidayService: new HolidayService({ repo: new HolidayRepository(db), fetchHolidays: null }),
      busyTimesProviders: [({ userId, from, to }) => calendars.busyTimes(userId, from, to)],
      listeners: [(event) => calendars.onBookingEvent(event)],
      runInBackground: (promise) => void pending.push(promise),
    });
  });

  const slots = () =>
    bookings
      .getAvailableSlots({
        username: "host",
        slug: "intro",
        from: "2030-01-07T00:00:00.000Z",
        to: "2030-01-07T23:59:00.000Z",
        timeZone: "UTC",
      })
      .then((result) => result.slots);

  it("hides slots that are busy in Google, then creates a Meet event and stores its link", async () => {
    google.busy = [{ start: "2030-01-07T10:00:00Z", end: "2030-01-07T11:00:00Z" }];
    expect(await slots()).not.toContain("2030-01-07T10:00:00.000Z");

    const { uid } = await bookings.create({
      username: "host",
      slug: "intro",
      start: "2030-01-07T12:00:00.000Z",
      timeZone: "UTC",
      locale: "en",
      responses: {
        name: "Greta",
        email: "greta@example.com",
        location: { value: "integrations:google:meet" },
      },
    });
    await Promise.all(pending);

    const [event] = [...google.events.values()];
    expect(event.calendarId).toBe("me@example.com");
    expect(event.body).toMatchObject({ attendees: [{ email: "greta@example.com", displayName: "Greta" }] });
    const [stored] = await db
      .select({ location: booking.location, metadata: booking.metadata })
      .from(booking)
      .where(eq(booking.uid, uid));
    expect(stored.location).toMatch(/^https:\/\/meet\.google\.com\//);
    expect(stored.metadata).toEqual({ videoCallUrl: stored.location });

    await bookings.cancel(uid, null, null);
    await Promise.all(pending);
    expect(google.events.size).toBe(0);
    expect((await db.select({ deleted: bookingReference.deleted }).from(bookingReference))[0].deleted).toBe(
      true
    );
  });

  it("keeps notes out of the event and makes it private when the event type asks", async () => {
    await db
      .update(eventType)
      .set({ hideCalendarNotes: true, hideCalendarEventDetails: true })
      .where(eq(eventType.slug, "intro"));
    await bookings.create({
      username: "host",
      slug: "intro",
      start: "2030-01-07T12:00:00.000Z",
      timeZone: "UTC",
      locale: "en",
      responses: { name: "Greta", email: "greta@example.com", notes: "Secret agenda" },
    });
    await Promise.all(pending);
    const [event] = [...google.events.values()];
    expect(event.body).toMatchObject({ visibility: "private" });
    expect(JSON.stringify(event.body)).not.toContain("Secret agenda");
  });
});
