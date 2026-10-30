import { describe, expect, it } from "vitest";
import type { EventTypeDto } from "../event-types/types";
import type { ApiBookingRow } from "./ApiBookingRepository";
import {
  createBookingInputSchema,
  listBookingsQuerySchema,
  listSort,
  toBookingOutput,
  toResponses,
} from "./bookingMapper";
import { applyEventTypeInput, createEventTypeInputSchema, toEventTypeOutput } from "./eventTypeMapper";
import { pagination } from "./http";
import { applyScheduleInput, toScheduleOutput } from "./scheduleMapper";
import { isoInTimeZone, slotsQuerySchema, slotsRange, toSlotsOutput } from "./slotsMapper";
import { applyWebhookInput, toWebhookOutput } from "./webhookMapper";

function bookingRow(overrides: Partial<ApiBookingRow> = {}): ApiBookingRow {
  return {
    id: 7,
    uid: "abc",
    title: "Intro between Ada and Host",
    description: null,
    status: "ACCEPTED",
    startTime: new Date("2030-01-07T10:00:00Z"),
    endTime: new Date("2030-01-07T10:30:00Z"),
    location: "https://meet.google.com/xyz",
    createdAt: new Date("2030-01-01T00:00:00Z"),
    updatedAt: null,
    responses: { name: "Ada", email: "ada@example.com", guests: ["bob@example.com"], notes: "hi" },
    metadata: { source: "zapier", count: 3 },
    cancellationReason: null,
    rejectionReason: null,
    cancelledBy: null,
    rescheduledBy: null,
    rescheduled: null,
    fromReschedule: null,
    recurringEventId: null,
    noShowHost: false,
    rating: null,
    iCalUID: "",
    userId: 1,
    eventTypeId: 3,
    eventTypeSlug: "intro",
    seatsPerTimeSlot: null,
    seatsShowAttendees: false,
    hostName: "Host",
    hostEmail: "host@example.com",
    hostUsername: "host",
    hostTimeZone: "Europe/London",
    attendees: [
      {
        bookingId: 7,
        name: "Ada",
        email: "ada@example.com",
        timeZone: "Europe/Paris",
        locale: "fr",
        phoneNumber: null,
        noShow: true,
      },
    ],
    rescheduledToUid: null,
    ...overrides,
  };
}

describe("bookings", () => {
  it("maps a booking to Cal's 2024-08-13 output", () => {
    expect(toBookingOutput(bookingRow())).toEqual({
      id: 7,
      uid: "abc",
      title: "Intro between Ada and Host",
      description: "",
      hosts: [
        {
          id: 1,
          name: "Host",
          email: "host@example.com",
          displayEmail: "host@example.com",
          username: "host",
          timeZone: "Europe/London",
        },
      ],
      status: "accepted",
      start: "2030-01-07T10:00:00.000Z",
      end: "2030-01-07T10:30:00.000Z",
      duration: 30,
      eventTypeId: 3,
      eventType: { id: 3, slug: "intro" },
      meetingUrl: "https://meet.google.com/xyz",
      location: "https://meet.google.com/xyz",
      absentHost: false,
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: null,
      metadata: { source: "zapier" },
      attendees: [
        {
          name: "Ada",
          email: "ada@example.com",
          displayEmail: "ada@example.com",
          timeZone: "Europe/Paris",
          language: "fr",
          absent: true,
        },
      ],
      guests: ["bob@example.com"],
      bookingFieldsResponses: {
        name: "Ada",
        email: "ada@example.com",
        guests: ["bob@example.com"],
        notes: "hi",
      },
    });
  });

  it("reports cancellation, rescheduling and series links", () => {
    const output = toBookingOutput(
      bookingRow({
        status: "CANCELLED",
        cancellationReason: "Sick",
        cancelledBy: "host@example.com",
        rescheduledToUid: "def",
        fromReschedule: "xyz",
        recurringEventId: "series",
        responses: { rescheduleReason: "Clash" },
      })
    );
    expect(output).toMatchObject({
      status: "cancelled",
      cancellationReason: "Sick",
      cancelledByEmail: "host@example.com",
      rescheduledToUid: "def",
      rescheduledFromUid: "xyz",
      recurringBookingUid: "series",
      reschedulingReason: "Clash",
    });
  });

  it("turns API input into the booking form's answers", () => {
    const input = createBookingInputSchema.parse({
      start: "2030-01-07T10:00:00Z",
      eventTypeId: 3,
      attendee: { name: "Ada", email: "ada@example.com", timeZone: "UTC", phoneNumber: "+44 20 1234 5678" },
      guests: ["bob@example.com"],
      location: { type: "attendeePhone", phone: "+44 20 1234 5678" },
      bookingFieldsResponses: { notes: "Agenda" },
    });
    expect(toResponses(input)).toEqual({
      notes: "Agenda",
      name: "Ada",
      email: "ada@example.com",
      guests: ["bob@example.com"],
      location: { value: "phone", optionValue: "+44 20 1234 5678" },
      attendeePhoneNumber: "+44 20 1234 5678",
    });
  });

  it("needs an event type by id or by username and slug", () => {
    const base = { start: "2030-01-07T10:00:00Z", attendee: { name: "A", email: "a@b.co", timeZone: "UTC" } };
    expect(createBookingInputSchema.safeParse(base).success).toBe(false);
    expect(
      createBookingInputSchema.safeParse({ ...base, eventTypeSlug: "intro", username: "host" }).success
    ).toBe(true);
  });

  it("parses comma-separated list filters and picks the sort", () => {
    const query = listBookingsQuerySchema.parse({
      status: "upcoming,past",
      eventTypeIds: "1,2",
      sortCreated: "desc",
    });
    expect(query).toMatchObject({ status: ["upcoming", "past"], eventTypeIds: [1, 2], take: 100, skip: 0 });
    expect(listSort(query)).toEqual({ column: "createdAt", direction: "desc" });
    expect(listSort(listBookingsQuerySchema.parse({}))).toEqual({ column: "startTime", direction: "asc" });
    expect(listBookingsQuerySchema.safeParse({ status: "upcoming,soon" }).success).toBe(false);
  });

  it("paginates like Cal", () => {
    expect(pagination(25, 10, 10, 10)).toEqual({
      totalItems: 25,
      remainingItems: 5,
      returnedItems: 10,
      itemsPerPage: 10,
      currentPage: 2,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});

function eventTypeDto(): EventTypeDto {
  return {
    id: 3,
    title: "Intro",
    slug: "intro",
    description: null,
    length: 30,
    multipleDuration: null,
    recurringEvent: null,
    seatsPerTimeSlot: null,
    seatsShowAttendees: false,
    seatsShowAvailabilityCount: true,
    hidden: false,
    scheduleId: null,
    locations: [{ type: "integrations:google:meet" }],
    minimumBookingNotice: 120,
    beforeEventBuffer: 0,
    afterEventBuffer: 0,
    slotInterval: null,
    periodType: "UNLIMITED",
    periodDays: null,
    periodCountCalendarDays: true,
    periodStartDate: null,
    periodEndDate: null,
    offsetStart: 0,
    onlyShowFirstAvailableSlot: false,
    bookingLimits: null,
    durationLimits: null,
    maxActiveBookingsPerBooker: null,
    maxActiveBookingPerBookerOfferReschedule: false,
    requiresConfirmation: false,
    requiresConfirmationThreshold: null,
    requiresConfirmationWillBlockSlot: false,
    disableCancelling: false,
    disableRescheduling: false,
    minimumRescheduleNotice: null,
    successRedirectUrl: null,
    forwardParamsSuccessRedirect: true,
    eventName: null,
    hideCalendarNotes: false,
    hideCalendarEventDetails: false,
    hideOrganizerEmail: false,
    requiresBookerEmailVerification: false,
    lockTimeZoneToggleOnBookingPage: false,
    lockedTimeZone: null,
    eventTypeColor: null,
    bookerLayouts: null,
    interfaceLanguage: null,
    disableConfirmationEmails: { host: false, attendee: false },
    bookingFields: [],
    privateLinks: [],
  };
}

describe("event types", () => {
  it("applies Cal's nested settings onto the app's", () => {
    const { id: _id, ...current } = eventTypeDto();
    const input = createEventTypeInputSchema.parse({
      title: "Demo",
      slug: "demo",
      lengthInMinutes: 45,
      lengthInMinutesOptions: [30, 45],
      locations: [{ type: "address", address: "1 Main St", public: true }, { type: "attendeePhone" }],
      recurrence: { frequency: "weekly", interval: 2, occurrences: 4 },
      bookingLimitsCount: { day: 2, week: 5 },
      bookingWindow: { type: "businessDays", value: 10, rolling: true },
      confirmationPolicy: {
        type: "time",
        noticeThreshold: { unit: "hours", count: 24 },
        blockUnconfirmedBookingsInBooker: true,
      },
      disableRescheduling: { minutesBefore: 60 },
      bookerLayouts: { defaultLayout: "week", enabledLayouts: ["week", "month"] },
      customName: "{Event type title} with {Scheduler}",
    });
    expect(applyEventTypeInput(current, input)).toMatchObject({
      title: "Demo",
      length: 45,
      multipleDuration: [30, 45],
      locations: [{ type: "inPerson", address: "1 Main St" }, { type: "phone" }],
      recurringEvent: { freq: 2, interval: 2, count: 4 },
      bookingLimits: { PER_DAY: 2, PER_WEEK: 5 },
      periodType: "ROLLING_WINDOW",
      periodDays: 10,
      periodCountCalendarDays: false,
      requiresConfirmation: true,
      requiresConfirmationThreshold: { time: 24, unit: "hours" },
      requiresConfirmationWillBlockSlot: true,
      disableRescheduling: false,
      minimumRescheduleNotice: 60,
      bookerLayouts: { defaultLayout: "week_view", enabledLayouts: ["week_view", "month_view"] },
      eventName: "{Event type title} with {Scheduler}",
      minimumBookingNotice: 120,
    });
  });

  it("resets a setting given as { disabled: true } and rejects fields it doesn't support", () => {
    const { id: _id, ...current } = { ...eventTypeDto(), seatsPerTimeSlot: 4 };
    expect(applyEventTypeInput(current, { seats: { disabled: true } }).seatsPerTimeSlot).toBeNull();
    expect(
      createEventTypeInputSchema.safeParse({ title: "a", slug: "a", lengthInMinutes: 5, price: 10 }).success
    ).toBe(false);
  });

  it("maps an event type to Cal's 2024-06-14 output", () => {
    const owner = {
      id: 1,
      name: "Host",
      username: "host",
      avatarUrl: null,
      weekStart: "Monday",
      brandColor: null,
      darkBrandColor: null,
      metadata: null,
      timeZone: "UTC",
    };
    const output = toEventTypeOutput(eventTypeDto(), owner, "https://cal.example.com");
    expect(output).toMatchObject({
      id: 3,
      ownerId: 1,
      lengthInMinutes: 30,
      locations: [{ type: "integration", integration: "google-meet" }],
      recurrence: null,
      seats: { disabled: true },
      bookingUrl: "https://cal.example.com/host/intro",
      users: [{ id: 1, username: "host", metadata: {} }],
    });
    expect(output).not.toHaveProperty("bookingWindow");
  });
});

describe("schedules", () => {
  it("round-trips weekly hours and overrides through Cal's shape", () => {
    const schedule = applyScheduleInput(null, {
      name: "Work",
      timeZone: "Europe/Rome",
      availability: [
        { days: ["Monday", "Tuesday"], startTime: "09:00", endTime: "12:00" },
        { days: ["Monday"], startTime: "13:00", endTime: "17:00" },
      ],
      overrides: [
        { date: "2030-01-07", startTime: "00:00", endTime: "00:00" },
        { date: "2030-01-08", startTime: "10:00", endTime: "11:00" },
      ],
    });
    expect(schedule.weeklyHours[1]).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
    expect(toScheduleOutput({ ...schedule, id: 5, isDefault: true }, 1)).toEqual({
      id: 5,
      ownerId: 1,
      name: "Work",
      timeZone: "Europe/Rome",
      isDefault: true,
      availability: [
        { days: ["Monday", "Tuesday"], startTime: "09:00", endTime: "12:00" },
        { days: ["Monday"], startTime: "13:00", endTime: "17:00" },
      ],
      overrides: [
        { date: "2030-01-07", startTime: "00:00", endTime: "00:00" },
        { date: "2030-01-08", startTime: "10:00", endTime: "11:00" },
      ],
    });
  });

  it("defaults a new schedule to weekdays 9 to 5 and keeps what an update leaves out", () => {
    const created = applyScheduleInput(null, { name: "Default", timeZone: "UTC" });
    expect(created.weeklyHours.map((ranges) => ranges.length)).toEqual([0, 1, 1, 1, 1, 1, 0]);
    expect(applyScheduleInput(created, { name: "Renamed" })).toEqual({ ...created, name: "Renamed" });
  });
});

describe("slots", () => {
  it("formats times like Luxon in the requested zone", () => {
    const date = new Date("2030-07-01T07:00:00Z");
    expect(isoInTimeZone(date, "Europe/Rome")).toBe("2030-07-01T09:00:00.000+02:00");
    expect(isoInTimeZone(date, "America/St_Johns")).toBe("2030-07-01T04:30:00.000-02:30");
    expect(isoInTimeZone(date, "UTC")).toBe("2030-07-01T07:00:00.000Z");
  });

  it("reads bare dates as whole UTC days", () => {
    expect(slotsRange({ start: "2030-07-01", end: "2030-07-02" })).toEqual({
      from: "2030-07-01T00:00:00.000Z",
      to: "2030-07-02T23:59:59.999Z",
    });
    expect(slotsQuerySchema.safeParse({ start: "2030-07-01", end: "2030-07-02" }).success).toBe(false);
  });

  it("groups slots by day in the zone, with ranges and seats", () => {
    const output = toSlotsOutput(
      {
        slots: ["2030-07-01T21:30:00.000Z", "2030-07-01T22:30:00.000Z"],
        seats: {
          total: 3,
          taken: { "2030-07-01T22:30:00.000Z": 2 },
          bookingUids: { "2030-07-01T22:30:00.000Z": "seated-uid" },
        },
        outOfOffice: {},
      },
      { timeZone: "Europe/Rome", format: "range", length: 30 }
    );
    expect(output).toEqual({
      "2030-07-01": [
        { start: "2030-07-01T23:30:00.000+02:00", end: "2030-07-02T00:00:00.000+02:00", attendeesCount: 0 },
      ],
      "2030-07-02": [
        {
          start: "2030-07-02T00:30:00.000+02:00",
          end: "2030-07-02T01:00:00.000+02:00",
          attendeesCount: 2,
          bookingUid: "seated-uid",
        },
      ],
    });
  });
});

describe("webhooks", () => {
  it("keeps the stored secret unless one is sent, and never returns it", () => {
    const current = {
      id: "w1",
      subscriberUrl: "https://example.com/hook",
      eventTriggers: ["BOOKING_CREATED" as const],
      active: true,
      hasSecret: true,
      payloadTemplate: null,
    };
    expect(applyWebhookInput(current, { active: false })).toEqual({
      subscriberUrl: "https://example.com/hook",
      eventTriggers: ["BOOKING_CREATED"],
      active: false,
      payloadTemplate: null,
      secret: undefined,
    });
    expect(toWebhookOutput(current, 1)).toEqual({
      id: "w1",
      userId: 1,
      subscriberUrl: "https://example.com/hook",
      triggers: ["BOOKING_CREATED"],
      active: true,
      payloadTemplate: null,
    });
  });
});
