import "@tanstack/react-start/server-only";
import dayjs from "@calcom/dayjs";
import type { JsonValue } from "@calcom/db/ids";
import { cuid, uuidv7 } from "@calcom/db/ids";
import {
  availabilityRange,
  type BusyInterval,
  computeAvailableSlots,
  type SlotEventConfig,
} from "@calcom/scheduling/available-slots";
import { limitCheckRange } from "@calcom/scheduling/limits";
import { outOfOfficeByDate } from "@calcom/scheduling/out-of-office";
import { recurringDates } from "@calcom/scheduling/recurring";
import type { OutOfOfficeData } from "@calcom/scheduling/types";
import { effectiveBookerLayouts } from "~/lib/booker-layouts";
import {
  type BookingField,
  type LocationResponse,
  parseBookingFields,
  userFieldAnswers,
  validateBookingResponses,
  withSystemFields,
} from "~/lib/booking-fields";
import { getEventName } from "~/lib/event-name";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { weekStartIndex } from "~/lib/time-format";
import { pickMessages } from "../catalog";
import { AppError } from "../errors";
import type { EventTypeRepository } from "../event-types/EventTypeRepository";
import {
  parseConfirmationThreshold,
  parseDisabledConfirmationEmails,
  parseEventTypeColor,
  parseIntervalLimit,
  parseMultipleDuration,
  parseRecurringEvent,
  toPeriodType,
} from "../event-types/fields";
import type { HashedLinkRepository } from "../event-types/HashedLinkRepository";
import { type EventLocation, eventLocationSchema } from "../event-types/types";
import type { HolidayService } from "../holidays/HolidayService";
import { parseMetadata } from "../metadata";
import type { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import type { ScheduleRepository } from "../schedules/ScheduleRepository";
import { isValidTimeZone } from "../schedules/scheduleMapper";
import type { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import type { UserRepository } from "../users/UserRepository";
import type { BookerVerificationService } from "../verification/BookerVerificationService";
import type {
  BookingRepository,
  HostBookingFilter,
  HostBookingSearch,
  NewBooking,
} from "./BookingRepository";
import { dynamicEventType, isDynamicGroup, parseUsernameList } from "./dynamicGroup";
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
  userRepo: Pick<UserRepository, "findByUsername" | "findProfile">;
  eventTypeRepo: Pick<EventTypeRepository, "findByUserIdAndSlug" | "findManyVisibleByUserId">;
  scheduleRepo: Pick<
    ScheduleRepository,
    "findByIdIncludeAvailability" | "findManyByUserIdIncludeAvailability"
  >;
  bookingRepo: BookingRepository;
  travelScheduleRepo: Pick<TravelScheduleRepository, "findByUserId">;
  oooRepo: Pick<OutOfOfficeRepository, "findOverlappingIncludeReasonAndUsers">;
  holidayService: Pick<HolidayService, "blockedDays">;
  bookerVerification?: Pick<BookerVerificationService, "send" | "verify">;
  hashedLinkRepo?: Pick<HashedLinkRepository, "findByLink" | "incrementUsage">;
  busyTimesProviders?: BusyTimesProvider[];
  listeners?: BookingListener[];
  runInBackground?: (promise: Promise<unknown>) => void;
  now?: () => Date;
};

const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

function bookingFieldsOf(eventType: {
  bookingFields: unknown;
  disableGuests: boolean;
  seatsPerTimeSlot?: number | null;
}): BookingField[] {
  const fields = withSystemFields(parseBookingFields(eventType.bookingFields), {
    disableGuests: eventType.disableGuests,
  });
  // Like Cal, seats replace guests: everyone books their own seat.
  if (!eventType.seatsPerTimeSlot) return fields;
  return fields.map((field) => (field.name === "guests" ? { ...field, hidden: true } : field));
}

type Host = NonNullable<Awaited<ReturnType<UserRepository["findByUsername"]>>>;

type CreatedBooking = {
  uid: string;
  title: string;
  status: string;
  redirectUrl: string | null;
  /** The booker's own seat, for seated events; it is how they cancel or move just their place. */
  seatReferenceUid?: string;
};

type EventTypeRow = NonNullable<Awaited<ReturnType<EventTypeRepository["findByUserIdAndSlug"]>>>;

/** The booker may book fewer occurrences than the event offers, never more. */
function recurringCount(max: number, requested: number | undefined): number {
  if (requested === undefined) return max;
  if (requested > max) throw new AppError("something_went_wrong");
  return requested;
}

/** Cal's validateEventLength: the booker's pick must be one the host offers. */
function eventLength(
  eventType: Pick<EventTypeRow, "length" | "metadata">,
  requested: number | undefined
): number {
  if (requested === undefined) return eventType.length;
  const allowed = parseMultipleDuration(eventType.metadata) ?? [eventType.length];
  if (!allowed.includes(requested)) throw new AppError("invalid_event_length");
  return requested;
}

/** Cal's isWithinMinimumRescheduleNotice: the booking starts soon, but hasn't started yet. */
function isWithinRescheduleNotice(startTime: Date, notice: number | null | undefined, now: Date): boolean {
  if (!notice || notice <= 0) return false;
  const untilStart = startTime.getTime() - now.getTime();
  return untilStart > 0 && untilStart < notice * 60_000;
}

type RedirectBooking = {
  uid: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  location: string | null;
  host: { name: string | null; timeZone: string };
  attendee: { name: string; timeZone: string };
  guests: string[];
  phone: string | null;
};

/**
 * The host's "redirect on booking" URL, with the booking's details as query parameters when
 * forwarding is on, named as in Cal's getBookingRedirectExtraParams.
 */
function successRedirectUrl(
  eventType: Pick<EventTypeRow, "successRedirectUrl" | "forwardParamsSuccessRedirect">,
  booking: RedirectBooking
): string | null {
  if (!eventType.successRedirectUrl) return null;
  const url = new URL(eventType.successRedirectUrl);
  if (eventType.forwardParamsSuccessRedirect === false) return url.toString();
  const params: Record<string, string | null> = {
    uid: booking.uid,
    title: booking.title,
    description: booking.description,
    startTime: booking.start.toISOString(),
    endTime: booking.end.toISOString(),
    location: booking.location,
    hostName: booking.host.name,
    hostStartTime: booking.host.name ? dayjs(booking.start).tz(booking.host.timeZone).format() : null,
    attendeeName: booking.attendee.name,
    attendeeStartTime: dayjs(booking.start).tz(booking.attendee.timeZone).format(),
    guestEmails: booking.guests.length ? booking.guests.join(", ") : null,
    phone: booking.phone,
    isEmbed: "false",
  };
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.append(key, value);
  return url.toString();
}

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

/** A group link's members shown as one host: everyone's names, the organizer's look. */
function groupHost(
  host: Parameters<typeof publicHost>[0] & { username: string | null },
  coHosts: { name: string | null; username: string | null }[],
  username: string
): PublicHostDto {
  return {
    ...publicHost(host, username),
    name: [host, ...coHosts].map((member) => member.name ?? member.username ?? "").join(", "),
  };
}

/** External calendars (e.g. Google) report busy time through this. */
export type BusyTimesProvider = (input: { userId: number; from: Date; to: Date }) => Promise<BusyInterval[]>;

export class BookingService {
  constructor(private readonly deps: Deps) {}

  async getProfile(username: string) {
    if (isDynamicGroup(username)) {
      // A group's page offers the one group meeting, as in Cal.
      const { host, eventType, coHosts } = await this.loadDynamicGroup(username);
      return {
        host: groupHost(host, coHosts, username),
        eventTypes: [
          { title: eventType.title, slug: eventType.slug, length: eventType.length, description: null },
        ],
      };
    }
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
    const { host, eventType, coHosts } = await this.loadEvent(username, slug);
    return {
      host: coHosts.length ? groupHost(host, coHosts, username) : publicHost(host, host.username ?? username),
      eventType: {
        // Group links book no event type; 0 stands for that internally.
        id: eventType.id || null,
        title: eventType.title,
        slug: eventType.slug,
        description: eventType.description,
        length: eventType.length,
        durations: parseMultipleDuration(eventType.metadata) ?? [eventType.length],
        requiresConfirmation: eventType.requiresConfirmation,
        // Only what the booker needs to choose; host phone numbers and links are revealed after booking.
        locations: parseLocations(eventType.locations).map((location) =>
          location.type === "inPerson"
            ? { type: location.type, address: location.address }
            : { type: location.type }
        ),
        bookingFields: bookingFieldsOf(eventType),
        // Cal falls back to the host's zone when the event locks one without naming it.
        requiresBookerEmailVerification: eventType.requiresBookerEmailVerification,
        recurringEvent: parseRecurringEvent(eventType.recurringEvent),
        lockedTimeZone: eventType.lockTimeZoneToggleOnBookingPage
          ? eventType.lockedTimeZone || host.timeZone
          : null,
        interfaceLanguage: eventType.interfaceLanguage || null,
        bookerLayouts: effectiveBookerLayouts(
          parseMetadata(eventType.metadata).bookerLayouts,
          parseMetadata(host.metadata).defaultBookerLayouts
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
    const { host, eventType, coHosts } = await this.loadEvent(query.username, query.slug);
    const { slots, outOfOffice, seatsTaken } = await this.computeSlots(
      host,
      eventType,
      from,
      to,
      query.timeZone,
      query.rescheduleUid,
      eventLength(eventType, query.duration),
      coHosts
    );
    const seats = eventType.seatsPerTimeSlot;
    return {
      slots: slots.map((slot) => slot.toISOString()),
      // Cal lets hosts hide how full a time is; then bookers only learn it's still bookable.
      seats:
        seats && eventType.seatsShowAvailabilityCount
          ? {
              total: seats,
              taken: Object.fromEntries(
                slots.map((slot) => [slot.toISOString(), seatsTaken.get(slot.getTime()) ?? 0])
              ),
            }
          : null,
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

  /** `actorUserId` is the signed-in user, if any; a host may move their own booking at any time. */
  async create(input: CreateBookingInput, actorUserId: number | null = null): Promise<CreatedBooking> {
    if (!isValidTimeZone(input.timeZone)) throw new AppError("invalid_timezone");
    const { host, eventType, coHosts } = await this.loadEvent(input.username, input.slug);
    const now = this.deps.now?.() ?? new Date();
    if (eventType.seatsPerTimeSlot)
      return this.bookSeat(input, host, eventType, eventType.seatsPerTimeSlot, actorUserId === host.id, now);
    const start = new Date(input.start);
    const length = eventLength(eventType, input.duration);
    const end = new Date(start.getTime() + length * 60_000);

    const original = input.rescheduleUid
      ? await this.findReschedulable(input.rescheduleUid, host.id, actorUserId === host.id, now)
      : null;

    await this.assertSlotOffered(host, eventType, start, input.timeZone, original?.uid, length, coHosts);
    const locations = parseLocations(eventType.locations);
    const responses = this.checkedResponses(eventType, input.responses, locations, Boolean(original));
    // name and email are system fields that are always shown and required.
    const name = String(responses.name);
    const email = String(responses.email);
    // Like Cal, moving an existing booking never counts against the booker's limit or needs a code.
    if (!original) await this.assertNewBookerAllowed(eventType, email, input.verificationCode);

    const locationResponse = responses.location as LocationResponse | undefined;
    const location = this.resolveLocation(locations, locationResponse);
    const attendeePhone =
      (locationResponse?.value === "phone" ? locationResponse.optionValue : undefined) ||
      (typeof responses.attendeePhoneNumber === "string" ? responses.attendeePhoneNumber : null);
    const notes = typeof responses.notes === "string" ? responses.notes : null;
    const title = await this.bookingTitle({ host, eventType, responses, name, location, length });
    const status = this.needsConfirmation(eventType, start, now) ? "PENDING" : "ACCEPTED";

    // Cal drops guests that repeat the booker.
    const guests = (Array.isArray(responses.guests) ? responses.guests : []).filter(
      (guest) => guest.toLowerCase() !== email.toLowerCase()
    );
    const attendeeBase = { timeZone: input.timeZone, locale: input.locale };

    // A recurring event books its occurrences together; moving one occurrence moves only that one.
    const rule = original ? null : parseRecurringEvent(eventType.recurringEvent);
    const starts = rule
      ? recurringDates(start, input.timeZone, {
          ...rule,
          count: recurringCount(rule.count, input.recurringCount),
        })
      : [start];
    const recurringEventId = rule ? uuidv7() : (original?.recurringEventId ?? null);
    const bookings = starts.map(
      (occurrenceStart): NewBooking => ({
        uid: cuid(),
        userId: host.id,
        userPrimaryEmail: host.email,
        // The group link's virtual event isn't stored.
        eventTypeId: eventType.id || null,
        title,
        description: notes,
        startTime: occurrenceStart,
        endTime: new Date(occurrenceStart.getTime() + length * 60_000),
        location,
        status,
        responses: responses as { [key: string]: JsonValue },
        fromReschedule: original?.uid ?? null,
        recurringEventId,
        attendees: [
          { ...attendeeBase, name, email, phoneNumber: attendeePhone },
          ...guests.map((guest) => ({ ...attendeeBase, name: "", email: guest, phoneNumber: null })),
          // Like Cal's collective events, a group link's other members attend the organizer's booking.
          ...coHosts.map((coHost) => ({
            name: coHost.name ?? coHost.username ?? coHost.email,
            email: coHost.email,
            timeZone: coHost.timeZone,
            locale: coHost.locale ?? "en",
            phoneNumber: null,
          })),
        ],
      })
    );
    if (input.hashedLink) await this.consumePrivateLink(input.hashedLink, eventType.id);
    const [firstBooking, ...rest] = bookings;
    const created = await this.deps.bookingRepo.insertSeriesIfFirstSlotFree([firstBooking, ...rest], {
      replacesUid: original?.uid,
    });
    if (!created) throw new AppError("booking_conflict_error", 409);
    const { uid } = firstBooking;

    await this.emitCreated(
      bookings.map((occurrence) => occurrence.uid),
      original?.uid ?? null
    );
    return {
      uid,
      title,
      status,
      redirectUrl: eventType.successRedirectUrl
        ? successRedirectUrl(eventType, {
            uid,
            title,
            description: notes,
            start,
            end,
            location,
            host: { name: host.name, timeZone: host.timeZone },
            attendee: { name, timeZone: input.timeZone },
            guests,
            phone: typeof responses.phone === "string" ? responses.phone : null,
          })
        : null,
    };
  }

  /**
   * Cal's handleSeats: the booker joins the booking already at that time if it has a free seat, or
   * starts one. With a seat reference as `rescheduleUid`, the seat moves: the booker takes a seat
   * at the new time and leaves the old one, which is cancelled once it has nobody left.
   */
  private async bookSeat(
    input: CreateBookingInput,
    host: NonNullable<Awaited<ReturnType<UserRepository["findByUsername"]>>>,
    eventType: EventTypeRow,
    seats: number,
    byHost: boolean,
    now: Date
  ): Promise<CreatedBooking> {
    const repo = this.deps.bookingRepo;
    const start = new Date(input.start);
    const end = new Date(start.getTime() + eventType.length * 60_000);
    const originalSeat = input.rescheduleUid ? await repo.findSeat(input.rescheduleUid) : null;
    if (input.rescheduleUid && !originalSeat) throw new AppError("booking_not_found", 404);
    if (originalSeat) await this.findReschedulable(originalSeat.bookingUid, host.id, byHost, now);

    await this.assertSlotOffered(host, eventType, start, input.timeZone, undefined, eventType.length);
    const locations = parseLocations(eventType.locations);
    const responses = this.checkedResponses(eventType, input.responses, locations, Boolean(originalSeat));
    const name = String(responses.name);
    const email = String(responses.email);
    if (!originalSeat) await this.assertNewBookerAllowed(eventType, email, input.verificationCode);

    const notes = typeof responses.notes === "string" ? responses.notes : null;
    const locationResponse = responses.location as LocationResponse | undefined;
    const location = this.resolveLocation(locations, locationResponse);
    const phone = locationResponse?.value === "phone" ? locationResponse.optionValue : null;
    const booker = {
      name,
      email,
      timeZone: input.timeZone,
      locale: input.locale,
      phoneNumber: phone || null,
    };
    const seat = {
      referenceUid: crypto.randomUUID(),
      data: { description: notes, responses: responses as { [key: string]: JsonValue } },
    };

    if (input.hashedLink) await this.consumePrivateLink(input.hashedLink, eventType.id);
    const existing = (
      await repo.findSeatedForEventType({ eventTypeId: eventType.id, from: start, to: end })
    ).find((seated) => seated.start.getTime() === start.getTime());
    let uid: string;
    if (existing) {
      uid = existing.uid;
      if (!(await repo.addSeat(uid, booker, seat, seats))) {
        const found = await repo.findByUid(uid);
        const signedUp = found?.attendees.some((attendee) => attendee.email === email.toLowerCase());
        throw new AppError(
          signedUp ? "already_signed_up_for_this_booking_error" : "booking_seats_full_error",
          409
        );
      }
    } else {
      uid = cuid();
      const title = await this.bookingTitle({
        host,
        eventType,
        responses,
        name,
        location,
        length: eventType.length,
      });
      const created = await repo.insertIfSlotFree({
        uid,
        userId: host.id,
        userPrimaryEmail: host.email,
        eventTypeId: eventType.id,
        title,
        description: notes,
        startTime: start,
        endTime: end,
        location,
        status: "ACCEPTED",
        responses: responses as { [key: string]: JsonValue },
        fromReschedule: null,
        recurringEventId: null,
        attendees: [booker],
        seat,
      });
      if (!created) throw new AppError("booking_conflict_error", 409);
    }

    const seatInfo = { referenceUid: seat.referenceUid, attendeeEmail: email.toLowerCase() };
    const snapshot = await this.snapshot(uid);
    if (originalSeat) {
      const previous = await this.leaveSeat(originalSeat);
      if (snapshot)
        this.emit({
          type: "BOOKING_RESCHEDULED",
          booking: snapshot,
          rescheduledFrom: previous ?? undefined,
          seat: seatInfo,
        });
    } else if (snapshot) {
      this.emit({ type: "BOOKING_CREATED", booking: snapshot, seat: seatInfo });
    }
    return {
      uid,
      title: snapshot?.title ?? eventType.title,
      status: "ACCEPTED",
      seatReferenceUid: seat.referenceUid,
      redirectUrl: null,
    };
  }

  /**
   * Frees a seat, cancelling the booking when it was the last one. Returns the booking as it was
   * before, so listeners can still reach the attendee who left.
   */
  private async leaveSeat(seat: NonNullable<Awaited<ReturnType<BookingRepository["findSeat"]>>>) {
    const before = await this.snapshot(seat.bookingUid);
    await this.deps.bookingRepo.removeAttendee(seat.attendeeId);
    if ((await this.deps.bookingRepo.countSeats(seat.bookingUid)) === 0)
      await this.deps.bookingRepo.updateStatus(seat.bookingUid, { status: "CANCELLED" });
    return before;
  }

  /** A booker gives up their seat; the booking goes on for everyone else. */
  async cancelSeat(referenceUid: string, reason: string | null): Promise<void> {
    const seat = await this.deps.bookingRepo.findSeat(referenceUid);
    if (!seat) throw new AppError("booking_not_found", 404);
    const found = await this.deps.bookingRepo.findByUid(seat.bookingUid);
    if (!found) throw new AppError("booking_not_found", 404);
    if (found.eventType?.disableCancelling) throw new AppError("cannot_cancel_booking", 403);
    if (found.status === "CANCELLED" || found.status === "REJECTED")
      throw new AppError("event_cancelled", 409);
    const before = await this.leaveSeat(seat);
    if (before)
      this.emit({
        type: "BOOKING_CANCELLED",
        booking: { ...before, cancellationReason: reason },
        seat: { referenceUid, attendeeEmail: seat.email },
      });
  }

  private async emitCreated(uids: string[], rescheduledFromUid: string | null): Promise<void> {
    if (rescheduledFromUid) {
      const [snapshot, previous] = await Promise.all([
        this.snapshot(uids[0]),
        this.snapshot(rescheduledFromUid),
      ]);
      if (snapshot)
        this.emit({ type: "BOOKING_RESCHEDULED", booking: snapshot, rescheduledFrom: previous ?? undefined });
      return;
    }
    for (const [seriesIndex, uid] of uids.entries()) {
      const snapshot = await this.snapshot(uid);
      if (!snapshot) continue;
      this.emit({
        type: snapshot.status === "PENDING" ? "BOOKING_REQUESTED" : "BOOKING_CREATED",
        booking: snapshot,
        seriesIndex: snapshot.recurring ? seriesIndex : undefined,
      });
    }
  }

  /** The slot list is the source of truth for what may be booked (hours, buffers, notice, window). */
  private async assertSlotOffered(
    host: NonNullable<Awaited<ReturnType<UserRepository["findByUsername"]>>>,
    eventType: EventTypeRow,
    start: Date,
    timeZone: string,
    excludeUid: string | undefined,
    length: number,
    coHosts: Host[] = []
  ): Promise<void> {
    const dayAround = 24 * 60 * 60 * 1000;
    const { slots } = await this.computeSlots(
      host,
      eventType,
      new Date(start.getTime() - dayAround),
      new Date(start.getTime() + dayAround),
      timeZone,
      excludeUid,
      length,
      coHosts
    );
    if (!slots.some((slot) => slot.getTime() === start.getTime()))
      throw new AppError("booking_conflict_error", 409);
  }

  /** The booker's answers, checked against the event's questions; the first problem is thrown. */
  private checkedResponses(
    eventType: EventTypeRow,
    raw: Record<string, unknown>,
    locations: EventLocation[],
    rescheduling: boolean
  ) {
    const { responses, errors } = validateBookingResponses(bookingFieldsOf(eventType), raw, {
      view: rescheduling ? "reschedule" : "booking",
      locationTypes: locations.map((option) => option.type),
    });
    if (errors.length) {
      const [first] = errors;
      throw new AppError(first.key, 400, { field: first.field, ...first.values });
    }
    return responses;
  }

  private async assertNewBookerAllowed(eventType: EventTypeRow, email: string, code: string | undefined) {
    await this.assertBookerUnderLimit(eventType, email);
    if (!eventType.requiresBookerEmailVerification) return;
    if (!code || !this.deps.bookerVerification)
      throw new AppError("email_verification_required", 400, { field: "verificationCode" });
    await this.deps.bookerVerification.verify(email, code);
  }

  private async bookingTitle(booking: {
    host: NonNullable<Awaited<ReturnType<UserRepository["findByUsername"]>>>;
    eventType: EventTypeRow;
    responses: Record<string, unknown>;
    name: string;
    location: string | null;
    length: number;
  }): Promise<string> {
    const { host, eventType, responses } = booking;
    const locationValue = (responses.location as LocationResponse | undefined)?.value ?? "";
    const locationKey = LOCATION_LABEL_KEYS[locationValue];
    const messages = await pickMessages(host.locale ?? "en", [
      "event_between_users",
      ...(locationKey ? [locationKey] : []),
    ]);
    return getEventName({
      template: eventType.eventName,
      eventTypeTitle: eventType.title,
      host: host.name ?? host.username ?? host.email,
      attendeeName: booking.name,
      locationLabel: (locationKey && messages[locationKey]) || booking.location || "",
      eventDuration: booking.length,
      responses,
      defaultTemplate: messages.event_between_users ?? "{{eventName}} between {{host}} and {{attendeeName}}",
    });
  }

  /** Where a private link leads, if it is still valid (Cal's HashedLinkService.validate). */
  async resolvePrivateLink(link: string, slug: string): Promise<{ username: string; slug: string }> {
    const found = await this.validPrivateLink(link);
    if (found.slug !== slug || !found.username) throw new AppError("private_link_expired", 404);
    return { username: found.username, slug: found.slug };
  }

  private async validPrivateLink(link: string) {
    const found = await this.deps.hashedLinkRepo?.findByLink(link);
    if (!found) throw new AppError("private_link_expired", 404);
    const now = this.deps.now?.() ?? new Date();
    const expired = found.expiresAt
      ? found.expiresAt < now
      : found.maxUsageCount > 0 && found.usageCount >= found.maxUsageCount;
    if (expired) throw new AppError("private_link_expired", 404);
    return found;
  }

  /** Counts a booking against a usage-limited link; dated links aren't counted, as in Cal. */
  private async consumePrivateLink(link: string, eventTypeId: number): Promise<void> {
    const found = await this.validPrivateLink(link);
    if (found.eventTypeId !== eventTypeId) throw new AppError("private_link_expired", 404);
    if (found.expiresAt || found.maxUsageCount <= 0) return;
    if (!(await this.deps.hashedLinkRepo?.incrementUsage(found.id)))
      throw new AppError("private_link_expired", 404);
  }

  /** Emails the booker a code, only for event types that ask for one. */
  async sendVerificationCode(username: string, slug: string, email: string, locale: string): Promise<void> {
    const { eventType } = await this.loadEvent(username, slug);
    if (!eventType.requiresBookerEmailVerification || !this.deps.bookerVerification)
      throw new AppError("something_went_wrong");
    await this.deps.bookerVerification.send(email, locale);
  }

  /**
   * The booking page's view. On a seated booking, `seatReferenceUid` says whose seat it is: their
   * answers are shown, and other attendees only when the host shares them.
   */
  async getBooking(uid: string, seatReferenceUid?: string): Promise<BookingDetailsDto> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found) throw new AppError("booking_not_found", 404);
    const seated = Boolean(found.eventType?.seatsPerTimeSlot);
    const seat = seatReferenceUid ? await this.deps.bookingRepo.findSeat(seatReferenceUid) : null;
    if (seatReferenceUid && seat?.bookingUid !== uid) throw new AppError("booking_not_found", 404);
    const seatData = (seat?.data ?? {}) as { responses?: Record<string, unknown> };
    const responses = (seat ? (seatData.responses ?? {}) : (found.responses ?? {})) as Record<
      string,
      unknown
    >;
    const attendees =
      seated && !found.eventType?.seatsShowAttendees
        ? found.attendees.filter((attendee) => attendee.email === seat?.email)
        : found.attendees;
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
      seatReferenceUid: seat?.referenceUid ?? null,
      // On a seated booking a booker can only cancel or move their own seat.
      canCancel: !found.eventType?.disableCancelling && (!seated || Boolean(seat)),
      recurring: await this.recurringDetails(found),
      // Like Cal's booking page, a series can be cancelled but not moved as a whole.
      canReschedule:
        !found.recurringEventId &&
        (!seated || Boolean(seat)) &&
        !found.eventType?.disableRescheduling &&
        !isWithinRescheduleNotice(
          found.startTime,
          found.eventType?.minimumRescheduleNotice,
          this.deps.now?.() ?? new Date()
        ),
      answers: found.eventType
        ? userFieldAnswers(bookingFieldsOf(found.eventType), responses).map(({ field, value }) => ({
            name: field.name,
            type: field.type,
            label: field.label ?? null,
            defaultLabel: field.defaultLabel ?? null,
            value,
          }))
        : [],
      host: found.host
        ? {
            name: found.host.name,
            email: found.eventType?.hideOrganizerEmail ? null : found.host.email,
            username: found.host.username,
            appearance: toAppearance(found.host),
          }
        : null,
      eventType: found.eventType
        ? { title: found.eventType.title, slug: found.eventType.slug, length: found.eventType.length }
        : null,
      attendees: attendees.map(({ name, email, timeZone }) => ({ name, email, timeZone })),
    };
  }

  /**
   * Anyone holding the uid (attendee or host) may cancel, as in Cal, unless the event type turned
   * cancelling off; the host can still cancel from their bookings.
   */
  async cancel(uid: string, reason: string | null, cancelledBy: string | null): Promise<void> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found) throw new AppError("booking_not_found", 404);
    if (found.eventType?.disableCancelling) throw new AppError("cannot_cancel_booking", 403);
    await this.cancelFound(found, reason, cancelledBy);
  }

  /**
   * Cancels the booking, or for a recurring booking with `allRemaining`, every occurrence that
   * hasn't started yet (Cal's "cancel all remaining").
   */
  private async cancelFound(
    found: NonNullable<Awaited<ReturnType<BookingRepository["findByUid"]>>>,
    reason: string | null,
    cancelledBy: string | null,
    allRemaining = true
  ): Promise<void> {
    if (found.status === "CANCELLED" || found.status === "REJECTED")
      throw new AppError("event_cancelled", 409);
    const now = this.deps.now?.() ?? new Date();
    const remaining =
      allRemaining && found.recurringEventId
        ? (await this.deps.bookingRepo.findSeries(found.recurringEventId))
            .filter((occurrence) => occurrence.status !== "CANCELLED" && occurrence.status !== "REJECTED")
            .filter((occurrence) => occurrence.uid === found.uid || occurrence.startTime >= now)
            .map((occurrence) => occurrence.uid)
        : [found.uid];
    await this.deps.bookingRepo.updateStatusMany(remaining, {
      status: "CANCELLED",
      cancellationReason: reason,
      cancelledBy,
    });
    await this.emitForEach(remaining, "BOOKING_CANCELLED");
  }

  /** One event per booking; for a series, marked so only the first notifies people. */
  private async emitForEach(uids: string[], type: BookingEvent["type"]): Promise<void> {
    for (const [index, uid] of uids.entries()) {
      const snapshot = await this.snapshot(uid);
      if (snapshot) this.emit({ type, booking: snapshot, seriesIndex: uids.length > 1 ? index : undefined });
    }
  }

  async listForHost(hostId: number, filter: HostBookingFilter, limit: number, search?: HostBookingSearch) {
    const profile = await this.deps.userRepo.findProfile(hostId);
    if (!profile) throw new AppError("user_not_found", 404);
    const rows = await this.deps.bookingRepo.findManyForHost({
      userId: hostId,
      email: profile.email,
      filter,
      search,
      now: this.deps.now?.() ?? new Date(),
      limit,
    });
    const listed = rows.map(({ recurringEvent, userId, ...row }) => {
      const rule = parseRecurringEvent(recurringEvent);
      return {
        ...row,
        // Only the organizer confirms, rejects or cancels; members of a group just attend.
        isOrganizer: userId === hostId,
        eventTypeColor: parseEventTypeColor(row.eventTypeColor),
        recurring: row.recurringEventId && rule ? { ...rule, count: 1 } : null,
      };
    });
    if (filter !== "recurring") return listed;
    // Cal's recurring tab shows each series once, at its next occurrence, with how many remain.
    const series = new Map<string, (typeof listed)[number]>();
    for (const row of listed) {
      const key = row.recurringEventId ?? row.uid;
      const first = series.get(key);
      if (!first) series.set(key, row);
      else if (first.recurring) first.recurring.count++;
    }
    return [...series.values()];
  }

  async cancelAsHost(
    hostId: number,
    uid: string,
    reason: string | null,
    allRemaining = false
  ): Promise<void> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found || found.userId !== hostId) throw new AppError("booking_not_found", 404);
    // From the host's list, one occurrence at a time unless they cancel the series.
    await this.cancelFound(found, reason, found.host?.email ?? null, allRemaining);
  }

  /** Host-only decisions on bookings that require confirmation. */
  async decide(hostId: number, uid: string, accept: boolean, reason: string | null): Promise<void> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found || found.userId !== hostId) throw new AppError("booking_not_found", 404);
    if (found.status !== "PENDING") throw new AppError("something_went_wrong", 409);
    // Like Cal, a recurring request is confirmed or rejected as a whole.
    const uids = found.recurringEventId
      ? (await this.deps.bookingRepo.findSeries(found.recurringEventId))
          .filter((occurrence) => occurrence.status === "PENDING")
          .map((occurrence) => occurrence.uid)
      : [uid];
    await this.deps.bookingRepo.updateStatusMany(
      uids,
      accept ? { status: "ACCEPTED" } : { status: "REJECTED", rejectionReason: reason }
    );
    await this.emitForEach(uids, accept ? "BOOKING_CREATED" : "BOOKING_REJECTED");
  }

  async snapshot(uid: string): Promise<BookingSnapshot | null> {
    const found = await this.deps.bookingRepo.findByUid(uid);
    if (!found?.host) return null;
    return {
      id: found.id,
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
      eventType: found.eventType
        ? {
            id: found.eventType.id,
            title: found.eventType.title,
            slug: found.eventType.slug,
            length: found.eventType.length,
            hideCalendarNotes: found.eventType.hideCalendarNotes,
            hideCalendarEventDetails: found.eventType.hideCalendarEventDetails,
            hideOrganizerEmail: found.eventType.hideOrganizerEmail,
            disableConfirmationEmails: parseDisabledConfirmationEmails(found.eventType.metadata),
          }
        : null,
      bookingFields: found.eventType ? bookingFieldsOf(found.eventType) : null,
      recurring: await this.recurringOf(found),
      organizer: { ...found.host, locale: found.host.locale ?? "en" },
      attendees: found.attendees,
    };
  }

  private async recurringDetails(found: {
    recurringEventId: string | null;
    eventType: { recurringEvent: unknown } | null;
  }): Promise<BookingDetailsDto["recurring"]> {
    if (!found.recurringEventId) return null;
    const rule = parseRecurringEvent(found.eventType?.recurringEvent);
    const series = await this.deps.bookingRepo.findSeries(found.recurringEventId);
    return {
      freq: rule?.freq ?? 2,
      interval: rule?.interval ?? 1,
      count: series.length,
      occurrences: series.map((occurrence) => ({
        uid: occurrence.uid,
        startTime: occurrence.startTime.toISOString(),
        endTime: occurrence.endTime.toISOString(),
        status: occurrence.status,
      })),
    };
  }

  private async recurringOf(found: {
    recurringEventId: string | null;
    eventType: { recurringEvent: unknown } | null;
  }): Promise<BookingSnapshot["recurring"]> {
    const details = await this.recurringDetails(found);
    return details && { freq: details.freq, interval: details.interval, count: details.count };
  }

  /** Hands the event to the listeners in the background; also used by BookingActionsService. */
  emit(event: BookingEvent) {
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

  private async loadEvent(
    username: string,
    slug: string
  ): Promise<{ host: Host; eventType: EventTypeRow; coHosts: Host[] }> {
    if (isDynamicGroup(username)) return this.loadDynamicGroup(username);
    const host = await this.deps.userRepo.findByUsername(username);
    if (!host) throw new AppError("user_not_found", 404);
    const eventType = await this.deps.eventTypeRepo.findByUserIdAndSlug(host.id, slug);
    if (!eventType) throw new AppError("event_type_not_found", 404);
    return { host, eventType, coHosts: [] };
  }

  /**
   * Cal's dynamic group links (/alice+bob): everyone named must allow them; the first organizes,
   * and times are those when all of them are free.
   */
  private async loadDynamicGroup(username: string) {
    const users = await Promise.all(
      parseUsernameList(username).map((name) => this.deps.userRepo.findByUsername(name))
    );
    const members = users.filter((member): member is Host => Boolean(member));
    if (members.length !== users.length) throw new AppError("user_not_found", 404);
    if (members.some((member) => member.allowDynamicBooking === false))
      throw new AppError("user_dynamic_booking_disabled", 403);
    const [host, ...coHosts] = members;
    const messages = await pickMessages(host.locale ?? "en", ["group_meeting"]);
    return { host, eventType: dynamicEventType(host.id, messages.group_meeting ?? "Group meeting"), coHosts };
  }

  /** Cal's "Limit number of upcoming bookings per booker". */
  private async assertBookerUnderLimit(eventType: EventTypeRow, email: string): Promise<void> {
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

  private async findReschedulable(uid: string, hostId: number, byHost: boolean, now: Date) {
    const original = await this.deps.bookingRepo.findByUid(uid);
    if (!original || original.userId !== hostId) throw new AppError("booking_not_found", 404);
    // After the host requests a reschedule the booking is cancelled, but its attendees may still
    // book a new time for it, once.
    const awaitingNewTime =
      original.status === "CANCELLED" &&
      original.rescheduled &&
      !(await this.deps.bookingRepo.hasReplacement(original.uid));
    if ((original.status === "CANCELLED" || original.status === "REJECTED") && !awaitingNewTime)
      throw new AppError("event_cancelled", 409);
    if (original.eventType?.disableRescheduling) throw new AppError("rescheduling_is_disabled", 403);
    if (
      !byHost &&
      isWithinRescheduleNotice(original.startTime, original.eventType?.minimumRescheduleNotice, now)
    )
      throw new AppError("reschedule_disabled_minimum_notice", 403);
    return original;
  }

  /** Cal's requiresConfirmationThreshold: with one set, only short-notice bookings need confirming. */
  private needsConfirmation(eventType: EventTypeRow, start: Date, now: Date): boolean {
    if (!eventType.requiresConfirmation) return false;
    const threshold = parseConfirmationThreshold(eventType.metadata);
    if (!threshold) return true;
    const thresholdMs = threshold.time * (threshold.unit === "hours" ? 3_600_000 : 60_000);
    return start.getTime() - now.getTime() < thresholdMs;
  }

  /** Slots for the host, or for a group, the times every member has free. */
  private async computeSlots(
    host: Host,
    eventType: EventTypeRow,
    from: Date,
    to: Date,
    inviteeTimeZone: string,
    excludeUid: string | undefined,
    length: number,
    coHosts: Host[] = []
  ): Promise<{ slots: Date[]; outOfOffice: OutOfOfficeData; seatsTaken: Map<number, number> }> {
    const own = await this.computeHostSlots(host, eventType, from, to, inviteeTimeZone, excludeUid, length);
    if (!coHosts.length) return own;
    const others = await Promise.all(
      coHosts.map((coHost) =>
        this.computeHostSlots(coHost, eventType, from, to, inviteeTimeZone, excludeUid, length)
      )
    );
    const shared = others.map((other) => new Set(other.slots.map((slot) => slot.getTime())));
    return {
      ...own,
      slots: own.slots.filter((slot) => shared.every((times) => times.has(slot.getTime()))),
    };
  }

  private async computeHostSlots(
    host: Host,
    eventType: EventTypeRow,
    from: Date,
    to: Date,
    inviteeTimeZone: string,
    excludeUid: string | undefined,
    length: number
  ): Promise<{ slots: Date[]; outOfOffice: OutOfOfficeData; seatsTaken: Map<number, number> }> {
    const scheduleId = eventType.scheduleId ?? host.defaultScheduleId;
    const schedule = scheduleId
      ? await this.deps.scheduleRepo.findByIdIncludeAvailability(scheduleId)
      : (await this.deps.scheduleRepo.findManyByUserIdIncludeAvailability(host.id))[0];
    if (!schedule || schedule.userId !== host.id)
      return { slots: [], outOfOffice: {}, seatsTaken: new Map() };

    const event: SlotEventConfig = {
      length,
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
    const seats = eventType.seatsPerTimeSlot;
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
      this.deps.bookingRepo.findBusyForUser({
        userId: host.id,
        email: host.email,
        ...range,
        excludeUid,
        excludeEventTypeId: seats ? eventType.id : undefined,
      }),
      ...(this.deps.busyTimesProviders ?? []).map((provider) => provider({ userId: host.id, ...range })),
    ]);
    const seated = seats
      ? (await this.deps.bookingRepo.findSeatedForEventType({ eventTypeId: eventType.id, ...range })).filter(
          (seatedBooking) => seatedBooking.uid !== excludeUid
        )
      : [];

    // An explicit out-of-office entry wins over a holiday on the same day, as in Cal.
    const outOfOffice = {
      ...holidays,
      ...outOfOfficeByDate(oooEntries, schedule.availability, this.deps.now?.()),
    };
    // A full seated booking is busy like any other; one with seats left only blocks other start times.
    const fullSeated = seated
      .filter((seatedBooking) => seats !== null && seatedBooking.seatsTaken >= seats)
      .map(({ start, end }) => ({ start, end }));
    const computed = computeAvailableSlots({
      availability: schedule.availability,
      scheduleTimeZone,
      event,
      busy: [...bookings, ...fullSeated, ...external.flat()],
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
    const seatsTaken = new Map(
      seated.map((seatedBooking) => [seatedBooking.start.getTime(), seatedBooking.seatsTaken])
    );
    const slots = seated.length
      ? computed.filter((slot) => {
          const end = slot.getTime() + length * 60_000;
          return seated.every(
            (seatedBooking) =>
              seatedBooking.start.getTime() === slot.getTime() ||
              seatedBooking.end.getTime() <= slot.getTime() ||
              seatedBooking.start.getTime() >= end
          );
        })
      : computed;
    return { slots, outOfOffice, seatsTaken };
  }

  private resolveLocation(
    locations: EventLocation[],
    chosenResponse: LocationResponse | undefined
  ): string | null {
    if (!locations.length) return null;
    const chosen = locations.find((location) => location.type === chosenResponse?.value) ?? locations[0];
    switch (chosen.type) {
      case "inPerson":
        return chosen.address;
      case "link":
        return chosen.link;
      case "userPhone":
        return chosen.hostPhoneNumber;
      case "phone":
        if (!chosenResponse?.optionValue) throw new AppError("enter_phone_number");
        return chosenResponse.optionValue;
      default:
        return chosen.type;
    }
  }
}
