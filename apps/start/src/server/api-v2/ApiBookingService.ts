import "@tanstack/react-start/server-only";

import type { z } from "zod";
import type { BookingService } from "../bookings/BookingService";
import { AppError } from "../errors";
import type { EventTypeRepository } from "../event-types/EventTypeRepository";
import type { ApiBookingRepository, ApiBookingRow } from "./ApiBookingRepository";
import type { ApiUserRepository } from "./ApiUserRepository";
import type { ApiUser } from "./auth";
import {
  type BookingOutput,
  type CreateBookingApiInput,
  type cancelBookingInputSchema,
  type ListBookingsApiQuery,
  listSort,
  type rescheduleBookingInputSchema,
  toBookingOutput,
  toResponses,
} from "./bookingMapper";
import { Paginated, pagination } from "./http";

type Deps = {
  bookings: BookingService;
  apiBookings: ApiBookingRepository;
  eventTypeRepo: EventTypeRepository;
  users: ApiUserRepository;
  now?: () => Date;
};

type CancelInput = z.infer<typeof cancelBookingInputSchema>;
type RescheduleInput = z.infer<typeof rescheduleBookingInputSchema>;

/** Cal's API v2 bookings endpoints, on top of the same BookingService the booking pages use. */
class ApiBookingService {
  constructor(private readonly deps: Deps) {}

  /** A recurring booking answers with every occurrence, a seated one with the booker's seat. */
  async create(
    input: CreateBookingApiInput,
    actor: ApiUser | null
  ): Promise<BookingOutput | BookingOutput[] | (BookingOutput & { seatUid: string })> {
    const { username, slug } = await this.eventTypeLink(input);
    const created = await this.deps.bookings.create(
      {
        username,
        slug,
        start: new Date(input.start).toISOString(),
        timeZone: input.attendee.timeZone,
        locale: input.attendee.language ?? "en",
        responses: toResponses(input),
        duration: input.lengthInMinutes,
        recurringCount: input.recurrenceCount,
        verificationCode: input.emailVerificationCode,
      },
      actor?.id ?? null
    );
    const row = await this.find(created.uid);
    if (created.seatReferenceUid) return { ...toBookingOutput(row), seatUid: created.seatReferenceUid };
    if (!row.recurringEventId) return toBookingOutput(row);
    return (await this.deps.apiBookings.findSeries(row.recurringEventId)).map(toBookingOutput);
  }

  async get(uid: string): Promise<BookingOutput> {
    return toBookingOutput(await this.find(uid));
  }

  async list(actor: ApiUser, query: ListBookingsApiQuery): Promise<Paginated<BookingOutput>> {
    const me = await this.deps.users.findMe(actor.id);
    if (!me) throw new AppError("unauthorized", 401);
    const eventTypeIds = [...(query.eventTypeIds ?? []), ...(query.eventTypeId ? [query.eventTypeId] : [])];
    const date = (value: string | undefined) => (value ? new Date(value) : undefined);
    const { bookings, total } = await this.deps.apiBookings.findMany({
      userId: actor.id,
      email: me.email,
      now: this.now(),
      statuses: query.status,
      attendeeEmail: query.attendeeEmail,
      attendeeName: query.attendeeName,
      bookingUid: query.bookingUid,
      eventTypeIds,
      afterStart: date(query.afterStart),
      beforeEnd: date(query.beforeEnd),
      afterCreatedAt: date(query.afterCreatedAt),
      beforeCreatedAt: date(query.beforeCreatedAt),
      afterUpdatedAt: date(query.afterUpdatedAt),
      beforeUpdatedAt: date(query.beforeUpdatedAt),
      sort: listSort(query),
      take: query.take,
      skip: query.skip,
    });
    const items = bookings.map(toBookingOutput);
    return new Paginated(items, pagination(total, query.take, query.skip, items.length));
  }

  /**
   * The host (the API key's owner) cancels as on their bookings list; anyone else holding the uid
   * cancels as an attendee would, or gives up just their seat.
   */
  async cancel(uid: string, input: CancelInput, actor: ApiUser | null): Promise<BookingOutput> {
    const row = await this.find(uid);
    const reason = input.cancellationReason ?? null;
    if (actor && row.userId === actor.id)
      await this.deps.bookings.cancelAsHost(actor.id, uid, reason, input.cancelSubsequentBookings ?? false);
    else if (input.seatUid) await this.deps.bookings.cancelSeat(input.seatUid, reason);
    else await this.deps.bookings.cancel(uid, reason, null);
    return this.get(uid);
  }

  /** Books the new time with the original answers; the old booking is marked rescheduled. */
  async reschedule(uid: string, input: RescheduleInput, actor: ApiUser | null): Promise<BookingOutput> {
    const row = await this.find(uid);
    if (row.eventTypeId === null) throw new AppError("booking_not_found", 404);
    const { username, slug } = await this.eventTypeLink({ eventTypeId: row.eventTypeId });
    const [booker] = row.attendees;
    const responses = row.responses && typeof row.responses === "object" ? row.responses : {};
    const created = await this.deps.bookings.create(
      {
        username,
        slug,
        start: new Date(input.start).toISOString(),
        timeZone: booker?.timeZone ?? row.hostTimeZone ?? "UTC",
        locale: booker?.locale ?? "en",
        responses: {
          ...responses,
          ...(input.reschedulingReason ? { rescheduleReason: input.reschedulingReason } : {}),
        },
        rescheduleUid: input.seatUid ?? uid,
        duration: Math.round((row.endTime.getTime() - row.startTime.getTime()) / 60_000),
      },
      actor?.id ?? null
    );
    return this.get(created.uid);
  }

  /** Host-only, for bookings that require confirmation. */
  async decide(uid: string, actor: ApiUser, accept: boolean, reason: string | null): Promise<BookingOutput> {
    await this.deps.bookings.decide(actor.id, uid, accept, reason);
    return this.get(uid);
  }

  private async find(uid: string): Promise<ApiBookingRow> {
    const row = await this.deps.apiBookings.findByUid(uid);
    if (!row) throw new AppError("booking_not_found", 404);
    return row;
  }

  /** The booking page an event type is booked through, which is what BookingService books on. */
  async eventTypeLink(input: {
    eventTypeId?: number;
    eventTypeSlug?: string;
    username?: string;
  }): Promise<{ username: string; slug: string }> {
    if (input.eventTypeId === undefined)
      return { username: input.username ?? "", slug: input.eventTypeSlug ?? "" };
    const eventType = await this.deps.eventTypeRepo.findById(input.eventTypeId);
    const owner = eventType?.userId ? await this.deps.users.findOwner(eventType.userId) : null;
    if (!eventType || !owner?.username) throw new AppError("event_type_not_found", 404);
    return { username: owner.username, slug: eventType.slug };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}

export { ApiBookingService };
