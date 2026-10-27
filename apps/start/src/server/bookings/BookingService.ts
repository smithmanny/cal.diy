import "@tanstack/react-start/server-only";
import type { JsonValue } from "@calcom/db/ids";
import { cuid } from "@calcom/db/ids";
import {
  availabilityRange,
  type BusyInterval,
  computeAvailableSlots,
  type SlotEventConfig,
} from "@calcom/scheduling/available-slots";
import { limitCheckRange } from "@calcom/scheduling/limits";
import { outOfOfficeByDate } from "@calcom/scheduling/out-of-office";
import type { OutOfOfficeData } from "@calcom/scheduling/types";
import { weekStartIndex } from "~/lib/time-format";
import { pickMessages } from "../catalog";
import { AppError } from "../errors";
import type { EventTypeRepository } from "../event-types/EventTypeRepository";
import { parseIntervalLimit, toPeriodType } from "../event-types/fields";
import { type EventLocation, eventLocationSchema } from "../event-types/types";
import type { HolidayService } from "../holidays/HolidayService";
import type { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import type { ScheduleRepository } from "../schedules/ScheduleRepository";
import { isValidTimeZone } from "../schedules/scheduleMapper";
import type { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import type { UserRepository } from "../users/UserRepository";
import type { BookingRepository } from "./BookingRepository";
import type { BookingEvent, BookingListener, BookingSnapshot } from "./events";
import type {
  AppearanceDto,
  BookingDetailsDto,
  CreateBookingInput,
  PublicEventDto,
  PublicHostDto,
  SlotsDto,
  SlotsQuery,
} from "./types";

type Deps = {
  userRepo: Pick<UserRepository, "findByUsername">;
  eventTypeRepo: Pick<EventTypeRepository, "findByUserIdAndSlug" | "findManyVisibleByUserId">;
  scheduleRepo: Pick<
    ScheduleRepository,
    "findByIdIncludeAvailability" | "findManyByUserIdIncludeAvailability"
  >;
  bookingRepo: BookingRepository;
  travelScheduleRepo: Pick<TravelScheduleRepository, "findByUserId">;
  oooRepo: Pick<OutOfOfficeRepository, "findOverlappingIncludeReasonAndUsers">;
  holidayService: Pick<HolidayService, "blockedDays">;
  busyTimesProviders?: BusyTimesProvider[];
  listeners?: BookingListener[];
  runInBackground?: (promise: Promise<unknown>) => void;
  now?: () => Date;
};

const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

function parseLocations(value: unknown): EventLocation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = eventLocationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

type AppearanceRow = {
  theme: string | null;
  brandColor: string | null;
  darkBrandColor: string | null;
  hideBranding: boolean;
};

function toAppearance(row: AppearanceRow): AppearanceDto {
  return {
    theme: row.theme === "light" || row.theme === "dark" ? row.theme : null,
    brandColor: row.brandColor,
    darkBrandColor: row.darkBrandColor,
    hideBranding: row.hideBranding,
  };
}

function publicHost(
  host: AppearanceRow & {
    name: string | null;
    avatarUrl: string | null;
    weekStart: string;
    allowSEOIndexing: boolean | null;
  },
  username: string
): PublicHostDto {
  return {
    name: host.name,
    username,
    avatarUrl: host.avatarUrl,
    weekStartDay: weekStartIndex(host.weekStart),
    allowSEOIndexing: host.allowSEOIndexing ?? true,
    appearance: toAppearance(host),
  };
}

/** External calendars (e.g. Google) report busy time through this. */
export type BusyTimesProvider = (input: { userId: number; from: Date; to: Date }) => Promise<BusyInterval[]>;

export class BookingService {
  constructor(private readonly deps: Deps) {}

  async getProfile(username: string) {
    const host = await this.deps.userRepo.findByUsername(username);
    if (!host?.username) throw new AppError("user_not_found", 404);
    const eventTypes = await this.deps.eventTypeRepo.findManyVisibleByUserId(host.id);
    return {
      host: publicHost(host, host.username),
      eventTypes: eventTypes.map(({ title, slug, length, description }) => ({
        title,
        slug,
        length,
        description,
      })),
    };
  }

  async getPublicEvent(username: string, slug: string): Promise<PublicEventDto> {
    const { host, eventType } = await this.loadEvent(username, slug);
    return {
      host: publicHost(host, host.username ?? username),
      eventType: {
        title: eventType.title,
        slug: eventType.slug,
        description: eventType.description,
        length: eventType.length,
        requiresConfirmation: eventType.requiresConfirmation,
        // Only what the booker needs to choose; host phone numbers and links are revealed after booking.
        locations: parseLocations(eventType.locations).map((location) =>
          location.type === "inPerson"
            ? { type: location.type, address: location.address }
            : { type: location.type }
        ),
      },
    };
  }

  async getAvailableSlots(query: SlotsQuery): Promise<SlotsDto> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (!(from < to) || to.getTime() - from.getTime() > MAX_RANGE_MS)
      throw new AppError("something_went_wrong");
    if (!isValidTimeZone(query.timeZone)) throw new AppError("invalid_timezone");
    const { host, eventType } = await this.loadEvent(query.username, query.slug);
    const { slots, outOfOffice } = await this.computeSlots(
      host,
      eventType,
      from,
      to,
      query.timeZone,
      query.rescheduleUid
    );
    return {
      slots: slots.map((slot) => slot.toISOString()),
      outOfOffice: Object.fromEntries(
        Object.entries(outOfOffice).map(([date, day]) => [
          date,
          {
            kind: day.fromUser ? "away" : "holiday",
            displayName: day.fromUser?.displayName ?? null,
            reason: day.reason ?? null,
            emoji: day.emoji ?? null,
            notes: day.notes ?? null,
            toUser: day.toUser?.username
              ? { username: day.toUser.username, displayName: day.toUser.displayName }
              : null,
          },
        ])
      ),
    };
  }

  async create(input: CreateBookingInput): Promise<{ uid: string; status: string }> {
    if (!isValidTimeZone(input.timeZone)) throw new AppError("invalid_timezone");
    const { host, eventType } = await this.loadEvent(input.username, input.slug);
    const start = new Date(input.start);
    const end = new Date(start.getTime() + eventType.length * 60_000);

    const original = input.rescheduleUid ? await this.findReschedulable(input.rescheduleUid, host.id) : null;

    // The slot list is the source of truth for what may be booked (hours, buffers, notice, window).
    const dayAround = 24 * 60 * 60 * 1000;
    const { slots } = await this.computeSlots(
      host,
      eventType,
      new Date(start.getTime() - dayAround),
      new Date(start.getTime() + dayAround),
      input.timeZone,
      original?.uid
    );
    if (!slots.some((slot) => slot.getTime() === start.getTime()))
      throw new AppError("booking_conflict_error", 409);
    // Like Cal, moving an existing booking never counts against the booker's limit.
    if (!original) await this.assertBookerUnderLimit(eventType, input.email);

    const location = this.resolveLocation(parseLocations(eventType.locations), input);
    const messages = await pickMessages(host.locale ?? "en", ["event_between_users"]);
    const title = (messages.event_between_users ?? "{{eventName}} between {{host}} and {{attendeeName}}")
      .replace("{{eventName}}", eventType.title)
      .replace("{{host}}", host.name ?? host.username ?? host.email)
      .replace("{{attendeeName}}", input.name);

    const responses: { [key: string]: JsonValue } = { name: input.name, email: input.email };
    if (input.notes) responses.notes = input.notes;
    if (input.attendeePhone) responses.attendeePhoneNumber = input.attendeePhone;
    if (location) responses.location = { value: input.locationType ?? "", optionValue: location };

    const uid = cuid();
    const created = await this.deps.bookingRepo.insertIfSlotFree(
      {
        uid,
        userId: host.id,
        userPrimaryEmail: host.email,
        eventTypeId: eventType.id,
        title,
        description: input.notes ?? null,
        startTime: start,
        endTime: end,
        location,
        status: eventType.requiresConfirmation ? "PENDING" : "ACCEPTED",
        responses,
        fromReschedule: original?.uid ?? null,
        attendee: {
          name: input.name,
          email: input.email,
          timeZone: input.timeZone,
          locale: input.locale,
          phoneNumber: input.attendeePhone ?? null,
        },
      },
      { replacesUid: original?.uid }
    );
    if (!created) throw new AppError("booking_conflict_error", 409);

    const snapshot = await this.snapshot(uid);
    if (snapshot) {
      if (original) {
        const previous = await this.snapshot(original.uid);
        this.emit({ type: "BOOKING_RESCHEDULED", booking: snapshot, rescheduledFrom: previous ?? undefined });
      } else {
        this.emit({
          type: snapshot.status === "PENDING" ? "BOOKING_REQUESTED" : "BOOKING_CREATED",
          booking: snapshot,
        });
      }
    }
    return { uid, status: eventType.requiresConfirmation ? "PENDING" : "ACCEPTED" };
  }

  async getBooking(uid: string): Promise<BookingDetailsDto> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found) throw new AppError("booking_not_found", 404);
    const responses = (found.responses ?? {}) as Record<string, unknown>;
    return {
      uid: found.uid,
      title: found.title,
      startTime: found.startTime.toISOString(),
      endTime: found.endTime.toISOString(),
      status: found.status,
      location: found.location,
      cancellationReason: found.cancellationReason,
      rescheduled: Boolean(found.rescheduled),
      notes: typeof responses.notes === "string" ? responses.notes : null,
      host: found.host
        ? {
            name: found.host.name,
            email: found.host.email,
            username: found.host.username,
            appearance: toAppearance(found.host),
          }
        : null,
      eventType: found.eventType
        ? { title: found.eventType.title, slug: found.eventType.slug, length: found.eventType.length }
        : null,
      attendees: found.attendees.map(({ name, email, timeZone }) => ({ name, email, timeZone })),
    };
  }

  /** Anyone holding the uid (attendee or host) may cancel, as in Cal. */
  async cancel(uid: string, reason: string | null, cancelledBy: string | null): Promise<void> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found) throw new AppError("booking_not_found", 404);
    if (found.status === "CANCELLED" || found.status === "REJECTED")
      throw new AppError("event_cancelled", 409);
    await this.deps.bookingRepo.updateStatus(uid, {
      status: "CANCELLED",
      cancellationReason: reason,
      cancelledBy,
    });
    const snapshot = await this.snapshot(uid);
    if (snapshot) this.emit({ type: "BOOKING_CANCELLED", booking: snapshot });
  }

  listForHost(hostId: number, filter: "upcoming" | "past" | "cancelled" | "unconfirmed", limit: number) {
    return this.deps.bookingRepo.findManyForHost({
      userId: hostId,
      filter,
      now: this.deps.now?.() ?? new Date(),
      limit,
    });
  }

  async cancelAsHost(hostId: number, uid: string, reason: string | null): Promise<void> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found || found.userId !== hostId) throw new AppError("booking_not_found", 404);
    await this.cancel(uid, reason, found.host?.email ?? null);
  }

  /** Host-only decisions on bookings that require confirmation. */
  async decide(hostId: number, uid: string, accept: boolean, reason: string | null): Promise<void> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found || found.userId !== hostId) throw new AppError("booking_not_found", 404);
    if (found.status !== "PENDING") throw new AppError("something_went_wrong", 409);
    await this.deps.bookingRepo.updateStatus(
      uid,
      accept ? { status: "ACCEPTED" } : { status: "REJECTED", rejectionReason: reason }
    );
    const snapshot = await this.snapshot(uid);
    if (snapshot) this.emit({ type: accept ? "BOOKING_CREATED" : "BOOKING_REJECTED", booking: snapshot });
  }

  async snapshot(uid: string): Promise<BookingSnapshot | null> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found?.host) return null;
    return {
      uid: found.uid,
      title: found.title,
      description: found.description,
      startTime: found.startTime,
      endTime: found.endTime,
      status: found.status,
      location: found.location,
      responses: (found.responses ?? {}) as Record<string, unknown>,
      cancellationReason: found.cancellationReason,
      fromReschedule: found.fromReschedule,
      eventType: found.eventType,
      organizer: { ...found.host, locale: found.host.locale ?? "en" },
      attendees: found.attendees,
    };
  }

  private emit(event: BookingEvent) {
    const listeners = this.deps.listeners ?? [];
    if (!listeners.length) return;
    // In order, not in parallel: the calendar listener fills in the Meet link that webhooks and
    // emails then include. One failing listener doesn't stop the rest.
    const work = (async () => {
      for (const listener of listeners) {
        try {
          await listener(event);
        } catch (error) {
          console.error(`Booking listener failed for ${event.type}`, error);
        }
      }
    })();
    if (this.deps.runInBackground) this.deps.runInBackground(work);
  }

  private async loadEvent(username: string, slug: string) {
    const host = await this.deps.userRepo.findByUsername(username);
    if (!host) throw new AppError("user_not_found", 404);
    const eventType = await this.deps.eventTypeRepo.findByUserIdAndSlug(host.id, slug);
    if (!eventType) throw new AppError("event_type_not_found", 404);
    return { host, eventType };
  }

  /** Cal's "Limit number of upcoming bookings per booker". */
  private async assertBookerUnderLimit(
    eventType: NonNullable<Awaited<ReturnType<EventTypeRepository["findByUserIdAndSlug"]>>>,
    email: string
  ): Promise<void> {
    const max = eventType.maxActiveBookingsPerBooker;
    if (!max) return;
    const upcoming = await this.deps.bookingRepo.findUpcomingForAttendee({
      eventTypeId: eventType.id,
      email,
      now: this.deps.now?.() ?? new Date(),
      limit: max,
    });
    if (upcoming.length < max) return;
    if (eventType.maxActiveBookingPerBookerOfferReschedule) {
      // The booker can move their latest booking to the new time instead.
      const latest = upcoming[upcoming.length - 1];
      throw new AppError("booker_limit_exceeded_error_reschedule", 409, {
        rescheduleUid: latest.uid,
        date: latest.startTime.toISOString(),
      });
    }
    throw new AppError("booker_upcoming_limit_reached", 409, { count: max });
  }

  private async findReschedulable(uid: string, hostId: number) {
    const original = await this.deps.bookingRepo.findByUid(uid);
    if (!original || original.userId !== hostId) throw new AppError("booking_not_found", 404);
    if (original.status === "CANCELLED" || original.status === "REJECTED")
      throw new AppError("event_cancelled", 409);
    return original;
  }

  private async computeSlots(
    host: NonNullable<Awaited<ReturnType<UserRepository["findByUsername"]>>>,
    eventType: NonNullable<Awaited<ReturnType<EventTypeRepository["findByUserIdAndSlug"]>>>,
    from: Date,
    to: Date,
    inviteeTimeZone: string,
    excludeUid?: string
  ): Promise<{ slots: Date[]; outOfOffice: OutOfOfficeData }> {
    const scheduleId = eventType.scheduleId ?? host.defaultScheduleId;
    const schedule = scheduleId
      ? await this.deps.scheduleRepo.findByIdIncludeAvailability(scheduleId)
      : (await this.deps.scheduleRepo.findManyByUserIdIncludeAvailability(host.id))[0];
    if (!schedule || schedule.userId !== host.id) return { slots: [], outOfOffice: {} };

    const event: SlotEventConfig = {
      length: eventType.length,
      slotInterval: eventType.slotInterval,
      minimumBookingNotice: eventType.minimumBookingNotice,
      beforeEventBuffer: eventType.beforeEventBuffer,
      afterEventBuffer: eventType.afterEventBuffer,
      periodType: toPeriodType(eventType.periodType),
      periodDays: eventType.periodDays,
      periodCountCalendarDays: eventType.periodCountCalendarDays ?? true,
      periodStartDate: eventType.periodStartDate,
      periodEndDate: eventType.periodEndDate,
      offsetStart: eventType.offsetStart,
      onlyShowFirstAvailableSlot: eventType.onlyShowFirstAvailableSlot ?? false,
      bookingLimits: parseIntervalLimit(eventType.bookingLimits),
      durationLimits: parseIntervalLimit(eventType.durationLimits),
    };
    const scheduleTimeZone = schedule.timeZone ?? host.timeZone;
    // A rolling window counts available days from today, so it may need data before `from`.
    const range = availabilityRange(event, from, to, this.deps.now?.());
    const limitRange =
      event.bookingLimits || event.durationLimits
        ? limitCheckRange([event.bookingLimits, event.durationLimits], range.from, range.to, scheduleTimeZone)
        : null;

    // Like Cal, trips only move the default schedule; a dedicated schedule keeps its own time zone.
    const isDefaultSchedule = !scheduleId || scheduleId === host.defaultScheduleId;
    const [travel, oooEntries, holidays, limitBookings, bookings, ...external] = await Promise.all([
      isDefaultSchedule ? this.deps.travelScheduleRepo.findByUserId(host.id) : Promise.resolve([]),
      this.deps.oooRepo.findOverlappingIncludeReasonAndUsers(host.id, range.from, range.to),
      this.deps.holidayService.blockedDays(host.id, range.from, range.to, schedule.availability),
      limitRange
        ? this.deps.bookingRepo.findAcceptedTimesForEventType({
            eventTypeId: eventType.id,
            ...limitRange,
            excludeUid,
          })
        : Promise.resolve([]),
      this.deps.bookingRepo.findBusyForUser({ userId: host.id, email: host.email, ...range, excludeUid }),
      ...(this.deps.busyTimesProviders ?? []).map((provider) => provider({ userId: host.id, ...range })),
    ]);

    // An explicit out-of-office entry wins over a holiday on the same day, as in Cal.
    const outOfOffice = {
      ...holidays,
      ...outOfOfficeByDate(oooEntries, schedule.availability, this.deps.now?.()),
    };
    const slots = computeAvailableSlots({
      availability: schedule.availability,
      scheduleTimeZone,
      event,
      busy: [...bookings, ...external.flat()],
      from,
      to,
      inviteeTimeZone,
      now: this.deps.now?.(),
      travelSchedules: travel.map((trip) => ({
        timeZone: trip.timeZone,
        start: trip.startDate,
        end: trip.endDate,
      })),
      outOfOffice,
      limitBookings,
    });
    return { slots, outOfOffice };
  }

  private resolveLocation(locations: EventLocation[], input: CreateBookingInput): string | null {
    if (!locations.length) return null;
    const chosen = locations.find((location) => location.type === input.locationType) ?? locations[0];
    switch (chosen.type) {
      case "inPerson":
        return chosen.address;
      case "link":
        return chosen.link;
      case "userPhone":
        return chosen.hostPhoneNumber;
      case "phone":
        if (!input.attendeePhone) throw new AppError("enter_phone_number");
        return input.attendeePhone;
      default:
        return chosen.type;
    }
  }
}
