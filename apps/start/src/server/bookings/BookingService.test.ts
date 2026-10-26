import type { Database } from "@calcom/db/database";
import { booking, eventType, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { EventTypeRepository } from "../event-types/EventTypeRepository";
import { HolidayRepository } from "../holidays/HolidayRepository";
import { HolidayService } from "../holidays/HolidayService";
import { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import { OutOfOfficeService } from "../out-of-office/OutOfOfficeService";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { ScheduleService } from "../schedules/ScheduleService";
import { DEFAULT_WEEKLY_HOURS } from "../schedules/scheduleMapper";
import { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import { UserRepository } from "../users/UserRepository";
import { BookingRepository } from "./BookingRepository";
import { BookingService } from "./BookingService";
import type { BookingEvent } from "./events";

let db: Database;
let service: BookingService;
let events: BookingEvent[];
let pending: Promise<unknown>[];
let hostId: number;

// Monday 2030-01-07; the host works 9-17 UTC.
const MONDAY = "2030-01-07";
const at = (time: string) => `${MONDAY}T${time}:00.000Z`;

beforeEach(async () => {
  db = await createTestDb();
  events = [];
  pending = [];
  const userRepo = new UserRepository(db);
  const scheduleRepo = new ScheduleRepository(db);
  [{ id: hostId }] = await db
    .insert(user)
    .values({ email: "host@example.com", username: "host", name: "Hana Host", timeZone: "UTC" })
    .returning({ id: user.id });
  await new ScheduleService({ scheduleRepo, userRepo }).create(hostId, {
    name: "Work",
    timeZone: "UTC",
    weeklyHours: DEFAULT_WEEKLY_HOURS,
    dateOverrides: [],
  });
  await db.insert(eventType).values([
    {
      userId: hostId,
      title: "Intro",
      slug: "intro",
      length: 60,
      minimumBookingNotice: 0,
      locations: [{ type: "phone" }, { type: "link", link: "https://meet.example/x" }],
    },
    {
      userId: hostId,
      title: "Approval",
      slug: "approval",
      length: 60,
      minimumBookingNotice: 0,
      requiresConfirmation: true,
    },
    { userId: hostId, title: "Secret", slug: "secret", length: 60, hidden: true },
  ]);
  service = new BookingService({
    userRepo,
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo,
    bookingRepo: new BookingRepository(db),
    travelScheduleRepo: new TravelScheduleRepository(db),
    oooRepo: new OutOfOfficeRepository(db),
    holidayService: new HolidayService({ repo: new HolidayRepository(db), fetchHolidays: null }),
    listeners: [async (event) => void events.push(event)],
    runInBackground: (promise) => void pending.push(promise),
  });
});

const daySlots = (slug = "intro") =>
  service.getAvailableSlots({
    username: "host",
    slug,
    from: at("00:00"),
    to: `${MONDAY}T23:59:00.000Z`,
    timeZone: "UTC",
  });
const slots = (slug = "intro") => daySlots(slug).then((result) => result.slots);

const book = (start: string, overrides: Record<string, unknown> = {}) =>
  service.create({
    username: "host",
    slug: "intro",
    start,
    timeZone: "Europe/Paris",
    locale: "en",
    name: "Guest",
    email: "guest@example.com",
    locationType: "link",
    ...overrides,
  });

describe("BookingService", () => {
  it("lists only visible event types on the profile", async () => {
    const profile = await service.getProfile("HOST");
    expect(profile.eventTypes.map((e) => e.slug).sort()).toEqual(["approval", "intro"]);
  });

  it("hides links and phone numbers from the public event details", async () => {
    const { eventType: details } = await service.getPublicEvent("host", "intro");
    expect(details.locations).toEqual([{ type: "phone" }, { type: "link" }]);
  });

  it("follows the host to another time zone during a trip", async () => {
    await new TravelScheduleRepository(db).create({
      userId: hostId,
      timeZone: "Asia/Tokyo",
      startDate: new Date("2030-01-06T15:00:00Z"), // Monday 00:00 in Tokyo
      endDate: new Date("2030-01-07T14:59:59Z"),
    });
    // 9-17 in Tokyo is 00:00-08:00 UTC.
    expect((await slots())[0]).toBe(at("00:00"));
    expect(await slots()).not.toContain(at("10:00"));
  });

  it("offers no slots while the host is out of office, and says why", async () => {
    const ooo = new OutOfOfficeService({
      oooRepo: new OutOfOfficeRepository(db),
      newUuid: () => crypto.randomUUID(),
    });
    const [vacation] = (await new OutOfOfficeRepository(db).findReasonsForUser(hostId)).filter(
      (reason) => reason.reason === "ooo_reasons_vacation"
    );
    await ooo.createOrUpdate(hostId, {
      startDate: MONDAY,
      endDate: MONDAY,
      reasonId: vacation.id,
      notes: "Back tomorrow",
      showNotePublicly: true,
    });
    const result = await daySlots();
    expect(result.slots).toEqual([]);
    expect(result.outOfOffice[MONDAY]).toEqual({
      kind: "away",
      displayName: "Hana Host",
      reason: "ooo_reasons_vacation",
      emoji: "🏝️",
      notes: "Back tomorrow",
      toUser: null,
    });
    await expect(book(at("10:00"))).rejects.toMatchObject({ code: "booking_conflict_error" });
  });

  it("books a free slot, emits BOOKING_CREATED, and the slot disappears", async () => {
    expect(await slots()).toContain(at("10:00"));
    const { uid, status } = await book(at("10:00"), { notes: "Agenda" });
    await Promise.all(pending);

    expect(status).toBe("ACCEPTED");
    expect(await service.getBooking(uid)).toMatchObject({
      title: "Intro between Hana Host and Guest",
      location: "https://meet.example/x",
      notes: "Agenda",
      attendees: [{ name: "Guest", email: "guest@example.com", timeZone: "Europe/Paris" }],
    });
    expect(events.map((e) => e.type)).toEqual(["BOOKING_CREATED"]);
    expect(await slots()).not.toContain(at("10:00"));
  });

  it("rejects times that aren't offered and slots already taken", async () => {
    await expect(book(at("10:30"))).rejects.toMatchObject({ code: "booking_conflict_error" });
    await expect(book(at("20:00"))).rejects.toMatchObject({ code: "booking_conflict_error" });
    await book(at("10:00"));
    await expect(book(at("10:00"), { email: "second@example.com" })).rejects.toMatchObject({
      code: "booking_conflict_error",
    });
  });

  it("requires the attendee's number for attendee-phone locations", async () => {
    await expect(book(at("11:00"), { locationType: "phone" })).rejects.toMatchObject({
      code: "enter_phone_number",
    });
    const { uid } = await book(at("11:00"), { locationType: "phone", attendeePhone: "+1 555 0100" });
    expect((await service.getBooking(uid)).location).toBe("+1 555 0100");
  });

  it("keeps bookings that need confirmation PENDING without blocking the slot, until accepted", async () => {
    const { uid, status } = await book(at("10:00"), { slug: "approval" });
    expect(status).toBe("PENDING");
    expect(await slots("approval")).toContain(at("10:00"));

    await service.decide(hostId, uid, true, null);
    expect((await service.getBooking(uid)).status).toBe("ACCEPTED");
    expect(await slots("approval")).not.toContain(at("10:00"));
    await Promise.all(pending);
    expect(events.map((e) => e.type)).toEqual(["BOOKING_REQUESTED", "BOOKING_CREATED"]);
  });

  it("lets only the host reject a pending booking", async () => {
    const { uid } = await book(at("10:00"), { slug: "approval" });
    await expect(service.decide(hostId + 999, uid, false, null)).rejects.toMatchObject({
      code: "booking_not_found",
    });
    await service.decide(hostId, uid, false, "Busy");
    expect((await service.getBooking(uid)).status).toBe("REJECTED");
  });

  it("reschedules by cancelling the original in the same batch, chaining fromReschedule", async () => {
    const { uid: original } = await book(at("10:00"));
    const { uid: moved } = await book(at("11:00"), { rescheduleUid: original });
    const { uid: final } = await book(at("12:00"), { rescheduleUid: moved });

    const rows = await db
      .select({
        uid: booking.uid,
        status: booking.status,
        rescheduled: booking.rescheduled,
        from: booking.fromReschedule,
      })
      .from(booking);
    expect(rows).toEqual(
      expect.arrayContaining([
        { uid: original, status: "CANCELLED", rescheduled: true, from: null },
        { uid: moved, status: "CANCELLED", rescheduled: true, from: original },
        { uid: final, status: "ACCEPTED", rescheduled: null, from: moved },
      ])
    );
    expect(await slots()).toContain(at("10:00"));
    await Promise.all(pending);
    expect(events.at(-1)).toMatchObject({ type: "BOOKING_RESCHEDULED", rescheduledFrom: { uid: moved } });
  });

  it("allows moving a booking to a time that overlaps itself", async () => {
    await db.update(eventType).set({ slotInterval: 30 }).where(eq(eventType.slug, "intro"));
    const { uid } = await book(at("10:00"));
    await expect(book(at("10:30"), { rescheduleUid: uid })).resolves.toMatchObject({ status: "ACCEPTED" });
  });

  it("cancels once, frees the slot, and reports a second cancel", async () => {
    const { uid } = await book(at("10:00"));
    await service.cancel(uid, "Conflict", "guest@example.com");
    expect(await service.getBooking(uid)).toMatchObject({
      status: "CANCELLED",
      cancellationReason: "Conflict",
    });
    expect(await slots()).toContain(at("10:00"));
    await expect(service.cancel(uid, null, null)).rejects.toMatchObject({ code: "event_cancelled" });
  });

  it("lists a host's bookings by tab", async () => {
    const accepted = await book(at("10:00"));
    const pendingBooking = await book(at("11:00"), { slug: "approval" });
    const cancelled = await book(at("12:00"));
    await service.cancel(cancelled.uid, null, null);
    const uids = async (filter: "upcoming" | "unconfirmed" | "cancelled" | "past") =>
      (await service.listForHost(hostId, filter, 50)).map((b) => b.uid);

    expect(await uids("upcoming")).toEqual([accepted.uid]);
    expect(await uids("unconfirmed")).toEqual([pendingBooking.uid]);
    expect(await uids("cancelled")).toEqual([cancelled.uid]);
    expect(await uids("past")).toEqual([]);
    expect((await service.listForHost(hostId, "upcoming", 50))[0].attendees).toEqual([
      { name: "Guest", email: "guest@example.com" },
    ]);
  });

  it("lets only the owning host cancel through the host endpoint", async () => {
    const { uid } = await book(at("10:00"));
    await expect(service.cancelAsHost(hostId + 1, uid, null)).rejects.toMatchObject({
      code: "booking_not_found",
    });
    await service.cancelAsHost(hostId, uid, "Sick");
    expect(await service.getBooking(uid)).toMatchObject({ status: "CANCELLED", cancellationReason: "Sick" });
  });

  it("reports unknown users, event types and bookings as not found", async () => {
    await expect(service.getProfile("nobody")).rejects.toMatchObject({ code: "user_not_found" });
    await expect(service.getPublicEvent("host", "nope")).rejects.toMatchObject({
      code: "event_type_not_found",
    });
    await expect(service.getBooking("nope")).rejects.toMatchObject({ code: "booking_not_found" });
  });

  it("refuses oversized slot ranges", async () => {
    await expect(
      service.getAvailableSlots({
        username: "host",
        slug: "intro",
        from: at("00:00"),
        to: "2030-06-01T00:00:00.000Z",
        timeZone: "UTC",
      })
    ).rejects.toMatchObject({ code: "something_went_wrong" });
  });
});
