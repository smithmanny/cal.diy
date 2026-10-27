import type { Database } from "@calcom/db/database";
import { attendee, booking, eventType, user } from "@calcom/db/schema";
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
import { BookerVerificationService } from "../verification/BookerVerificationService";
import { VerificationRepository } from "../verification/VerificationRepository";
import { BookingRepository } from "./BookingRepository";
import { BookingService } from "./BookingService";
import type { BookingEvent } from "./events";

let db: Database;
let service: BookingService;
let serviceDeps: ConstructorParameters<typeof BookingService>[0];
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
  serviceDeps = {
    userRepo,
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo,
    bookingRepo: new BookingRepository(db),
    travelScheduleRepo: new TravelScheduleRepository(db),
    oooRepo: new OutOfOfficeRepository(db),
    holidayService: new HolidayService({ repo: new HolidayRepository(db), fetchHolidays: null }),
    listeners: [async (event) => void events.push(event)],
    runInBackground: (promise) => void pending.push(promise),
  };
  service = new BookingService(serviceDeps);
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

type BookOptions = {
  slug?: string;
  rescheduleUid?: string;
  email?: string;
  notes?: string;
  location?: { value: string; optionValue?: string };
  responses?: Record<string, unknown>;
};

const input = (start: string, slug = "intro", email = "guest@example.com") => ({
  username: "host",
  slug,
  start,
  timeZone: "Europe/Paris",
  locale: "en",
  responses: { name: "Guest", email, location: { value: "link" } },
});

const book = (start: string, options: BookOptions = {}) =>
  service.create({
    username: "host",
    slug: options.slug ?? "intro",
    start,
    timeZone: "Europe/Paris",
    locale: "en",
    rescheduleUid: options.rescheduleUid,
    responses: {
      name: "Guest",
      email: options.email ?? "guest@example.com",
      location: options.location ?? { value: "link" },
      ...(options.notes ? { notes: options.notes } : {}),
      ...options.responses,
    },
  });

describe("BookingService", () => {
  it("lists only visible event types on the profile", async () => {
    const profile = await service.getProfile("HOST");
    expect(profile.eventTypes.map((e) => e.slug).sort()).toEqual(["approval", "intro"]);
  });

  it("shows bookers the locked time zone and language, and can hide the host's address", async () => {
    await db
      .update(eventType)
      .set({ lockTimeZoneToggleOnBookingPage: true, interfaceLanguage: "fr", hideOrganizerEmail: true })
      .where(eq(eventType.slug, "intro"));
    expect((await service.getPublicEvent("host", "intro")).eventType).toMatchObject({
      lockedTimeZone: "UTC",
      interfaceLanguage: "fr",
    });
    const { uid } = await book(at("10:00"));
    expect((await service.getBooking(uid)).host).toMatchObject({ name: "Hana Host", email: null });
  });

  it("offers the event's durations and books the one picked", async () => {
    await db
      .update(eventType)
      .set({ length: 60, metadata: { multipleDuration: [30, 60, 90] } })
      .where(eq(eventType.slug, "intro"));
    expect((await service.getPublicEvent("host", "intro")).eventType.durations).toEqual([30, 60, 90]);
    const query = {
      username: "host",
      slug: "intro",
      from: at("00:00"),
      to: `${MONDAY}T23:59:00.000Z`,
      timeZone: "UTC",
    };
    const half = (await service.getAvailableSlots({ ...query, duration: 30 })).slots;
    expect(half).toContain(at("16:30"));
    expect((await service.getAvailableSlots(query)).slots).not.toContain(at("16:30"));
    await expect(service.getAvailableSlots({ ...query, duration: 45 })).rejects.toMatchObject({
      code: "invalid_event_length",
    });

    const { uid } = await service.create({ ...input(at("16:30")), duration: 30 });
    const booked = await service.getBooking(uid);
    expect(booked.endTime).toBe(at("17:00"));
  });

  it("asks bookers for an emailed code when the event type requires one", async () => {
    const codes: string[] = [];
    const verifying = new BookingService({
      ...serviceDeps,
      bookerVerification: new BookerVerificationService({
        repo: new VerificationRepository(db),
        secret: "s",
        sendCode: async (_email, code) => void codes.push(code),
      }),
    });
    await db
      .update(eventType)
      .set({ requiresBookerEmailVerification: true })
      .where(eq(eventType.slug, "intro"));
    expect((await verifying.getPublicEvent("host", "intro")).eventType.requiresBookerEmailVerification).toBe(
      true
    );
    await expect(verifying.create(input(at("10:00")))).rejects.toMatchObject({
      code: "email_verification_required",
    });
    await verifying.sendVerificationCode("host", "intro", "guest@example.com", "en");
    const { uid } = await verifying.create({ ...input(at("10:00")), verificationCode: codes[0] });
    // Moving the booking later needs no new code.
    await expect(verifying.create({ ...input(at("11:00")), rescheduleUid: uid })).resolves.toBeTruthy();
    await expect(
      verifying.sendVerificationCode("host", "approval", "x@example.com", "en")
    ).rejects.toMatchObject({
      code: "something_went_wrong",
    });
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

  it("closes the day once the event's daily booking limit is reached", async () => {
    await db
      .update(eventType)
      .set({ bookingLimits: { PER_DAY: 1 } })
      .where(eq(eventType.slug, "intro"));
    await book(at("10:00"));
    expect(await slots()).toEqual([]);
  });

  it("caps upcoming bookings per booker, or offers to move their latest one", async () => {
    await db.update(eventType).set({ maxActiveBookingsPerBooker: 1 }).where(eq(eventType.slug, "intro"));
    const first = await book(at("10:00"));
    await expect(book(at("12:00"))).rejects.toMatchObject({
      code: "booker_upcoming_limit_reached",
      values: { count: 1 },
    });
    // Someone else can still book.
    await expect(book(at("13:00"), { email: "other@example.com" })).resolves.toMatchObject({
      status: "ACCEPTED",
    });

    await db
      .update(eventType)
      .set({ maxActiveBookingPerBookerOfferReschedule: true })
      .where(eq(eventType.slug, "intro"));
    await expect(book(at("12:00"))).rejects.toMatchObject({
      code: "booker_limit_exceeded_error_reschedule",
      values: { rescheduleUid: first.uid },
    });
    // Accepting the offer moves the booking, which the limit allows.
    await expect(book(at("12:00"), { rescheduleUid: first.uid })).resolves.toMatchObject({
      status: "ACCEPTED",
    });
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
    await expect(book(at("11:00"), { location: { value: "phone" } })).rejects.toMatchObject({
      code: "error_required_field",
      values: { field: "location" },
    });
    const { uid } = await book(at("11:00"), { location: { value: "phone", optionValue: "+1 555 0100" } });
    expect((await service.getBooking(uid)).location).toBe("+1 555 0100");
  });

  describe("booking questions", () => {
    beforeEach(async () => {
      await db
        .update(eventType)
        .set({
          bookingFields: [
            { name: "company", type: "text", label: "Company", required: true, editable: "user" },
            {
              name: "size",
              type: "select",
              label: "Team size",
              required: false,
              editable: "user",
              options: [
                { label: "1-10", value: "small" },
                { label: "11+", value: "large" },
              ],
            },
            { name: "email", type: "email", excludeEmails: "gmail.com" },
          ],
        })
        .where(eq(eventType.slug, "intro"));
    });

    it("requires the host's questions and checks answers against their options", async () => {
      await expect(book(at("10:00"))).rejects.toMatchObject({
        code: "error_required_field",
        values: { field: "company" },
      });
      await expect(book(at("10:00"), { responses: { company: "Acme", size: "huge" } })).rejects.toMatchObject(
        {
          values: { field: "size" },
        }
      );
      await expect(
        book(at("10:00"), { email: "me@gmail.com", responses: { company: "Acme" } })
      ).rejects.toMatchObject({ code: "exclude_emails_match_found_error_message" });
    });

    it("stores answers to what was asked only, and shows the host's answers back", async () => {
      const { uid } = await book(at("10:00"), {
        responses: { company: " Acme ", size: "small", injected: "x", rescheduleReason: "not asked" },
      });
      const [stored] = await db
        .select({ responses: booking.responses })
        .from(booking)
        .where(eq(booking.uid, uid));
      expect(stored.responses).toEqual({
        name: "Guest",
        email: "guest@example.com",
        location: { value: "link", optionValue: "" },
        company: "Acme",
        size: "small",
      });
      expect((await service.getBooking(uid)).answers).toEqual([
        { name: "company", type: "text", label: "Company", defaultLabel: null, value: "Acme" },
        { name: "size", type: "select", label: "Team size", defaultLabel: null, value: "small" },
      ]);
    });

    it("asks the reschedule reason only when rescheduling", async () => {
      const { uid } = await book(at("10:00"), { responses: { company: "Acme" } });
      const moved = await book(at("11:00"), {
        rescheduleUid: uid,
        responses: { company: "Acme", rescheduleReason: "Clash" },
      });
      const [stored] = await db
        .select({ responses: booking.responses })
        .from(booking)
        .where(eq(booking.uid, moved.uid));
      expect(stored.responses).toMatchObject({ rescheduleReason: "Clash" });
    });
  });

  it("adds guests as attendees, skipping the booker and rejecting duplicates", async () => {
    await expect(
      book(at("10:00"), { responses: { guests: ["a@example.com", "A@example.com"] } })
    ).rejects.toMatchObject({ code: "duplicate_email", values: { field: "guests" } });
    const { uid } = await book(at("10:00"), {
      responses: { guests: ["a@example.com", "guest@example.com", ""] },
    });
    const [{ id }] = await db.select({ id: booking.id }).from(booking).where(eq(booking.uid, uid));
    const rows = await db.select({ email: attendee.email }).from(attendee).where(eq(attendee.bookingId, id));
    expect(rows.map((row) => row.email).sort()).toEqual(["a@example.com", "guest@example.com"]);
  });

  it("refuses guests when the host disabled them", async () => {
    await db.update(eventType).set({ disableGuests: true }).where(eq(eventType.slug, "intro"));
    const { uid } = await book(at("10:00"), { responses: { guests: ["a@example.com"] } });
    expect((await service.getBooking(uid)).attendees).toHaveLength(1);
  });

  it("names bookings from the event's template, with question answers", async () => {
    await db
      .update(eventType)
      .set({
        eventName: "{Scheduler first name} x {Organiser} ({Event duration}, {Location}) {notes}{missing}",
      })
      .where(eq(eventType.slug, "intro"));
    const { uid } = await book(at("10:00"), { notes: "Acme", responses: { name: "Greta Guest" } });
    expect((await service.getBooking(uid)).title).toBe("Greta x Hana Host (60 mins, Link meeting) Acme");
  });

  it("only asks for confirmation within the threshold, when one is set", async () => {
    await db
      .update(eventType)
      .set({ metadata: { requiresConfirmationThreshold: { time: 2, unit: "hours" }, apps: { x: 1 } } })
      .where(eq(eventType.slug, "approval"));
    const early = new BookingService({ ...serviceDeps, now: () => new Date(at("08:30")) });
    await expect(early.create(input(at("11:00"), "approval"))).resolves.toMatchObject({ status: "ACCEPTED" });
    await expect(early.create(input(at("09:00"), "approval", "b@example.com"))).resolves.toMatchObject({
      status: "PENDING",
    });
  });

  it("lets unconfirmed bookings block the slot when the event type says so", async () => {
    await db
      .update(eventType)
      .set({ requiresConfirmationWillBlockSlot: true })
      .where(eq(eventType.slug, "approval"));
    await book(at("10:00"), { slug: "approval" });
    expect(await slots("approval")).not.toContain(at("10:00"));
    expect(await slots()).not.toContain(at("10:00"));
    await expect(book(at("10:00"), { email: "b@example.com" })).rejects.toMatchObject({
      code: "booking_conflict_error",
    });
  });

  it("stops bookers cancelling or rescheduling when the host turned it off", async () => {
    const { uid } = await book(at("10:00"));
    await db
      .update(eventType)
      .set({ disableCancelling: true, disableRescheduling: true })
      .where(eq(eventType.slug, "intro"));
    expect(await service.getBooking(uid)).toMatchObject({ canCancel: false, canReschedule: false });
    await expect(service.cancel(uid, null, null)).rejects.toMatchObject({ code: "cannot_cancel_booking" });
    await expect(book(at("11:00"), { rescheduleUid: uid })).rejects.toMatchObject({
      code: "rescheduling_is_disabled",
    });
    await service.cancelAsHost(hostId, uid, "Host can");
    expect((await service.getBooking(uid)).status).toBe("CANCELLED");
  });

  it("refuses late reschedules within the minimum notice, except by the host", async () => {
    await db.update(eventType).set({ minimumRescheduleNotice: 60 }).where(eq(eventType.slug, "intro"));
    const { uid } = await book(at("10:00"));
    const late = new BookingService({ ...serviceDeps, now: () => new Date(at("09:30")) });
    expect(await late.getBooking(uid)).toMatchObject({ canReschedule: false, canCancel: true });
    await expect(late.create({ ...input(at("11:00")), rescheduleUid: uid })).rejects.toMatchObject({
      code: "reschedule_disabled_minimum_notice",
    });
    await expect(late.create({ ...input(at("11:00")), rescheduleUid: uid }, hostId)).resolves.toMatchObject({
      status: "ACCEPTED",
    });
  });

  it("sends bookers to the host's page with the booking's details", async () => {
    await db
      .update(eventType)
      .set({ successRedirectUrl: "https://example.com/thanks?ref=cal" })
      .where(eq(eventType.slug, "intro"));
    const { uid, redirectUrl } = await book(at("10:00"), { responses: { guests: ["gus@example.com"] } });
    const url = new URL(redirectUrl ?? "");
    expect(url.origin + url.pathname).toBe("https://example.com/thanks");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      ref: "cal",
      uid,
      startTime: "2030-01-07T10:00:00.000Z",
      attendeeName: "Guest",
      attendeeStartTime: "2030-01-07T11:00:00+01:00",
      hostName: "Hana Host",
      guestEmails: "gus@example.com",
    });

    await db
      .update(eventType)
      .set({ forwardParamsSuccessRedirect: false })
      .where(eq(eventType.slug, "intro"));
    expect((await book(at("12:00"), { email: "b@example.com" })).redirectUrl).toBe(
      "https://example.com/thanks?ref=cal"
    );
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
