import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { attendee, booking, eventType, user } from "@calcom/db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

/** Cal's API v2 booking statuses, which may be combined (`?status=upcoming,past`). */
type BookingListStatus = "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed";

type BookingListQuery = {
  userId: number;
  /** Bookings the user attends are listed too, as in Cal. */
  email: string;
  now: Date;
  statuses?: BookingListStatus[];
  attendeeEmail?: string;
  attendeeName?: string;
  bookingUid?: string;
  eventTypeIds?: number[];
  afterStart?: Date;
  beforeEnd?: Date;
  afterCreatedAt?: Date;
  beforeCreatedAt?: Date;
  afterUpdatedAt?: Date;
  beforeUpdatedAt?: Date;
  sort: { column: "startTime" | "endTime" | "createdAt" | "updatedAt"; direction: "asc" | "desc" };
  take: number;
  skip: number;
};

const ENDED = ["CANCELLED", "REJECTED"] as const;

const bookingColumns = {
  id: booking.id,
  uid: booking.uid,
  title: booking.title,
  description: booking.description,
  status: booking.status,
  startTime: booking.startTime,
  endTime: booking.endTime,
  location: booking.location,
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
  responses: booking.responses,
  metadata: booking.metadata,
  cancellationReason: booking.cancellationReason,
  rejectionReason: booking.rejectionReason,
  cancelledBy: booking.cancelledBy,
  rescheduledBy: booking.rescheduledBy,
  rescheduled: booking.rescheduled,
  fromReschedule: booking.fromReschedule,
  recurringEventId: booking.recurringEventId,
  noShowHost: booking.noShowHost,
  rating: booking.rating,
  iCalUID: booking.iCalUID,
  userId: booking.userId,
  eventTypeId: booking.eventTypeId,
  eventTypeSlug: eventType.slug,
  hostName: user.name,
  hostEmail: user.email,
  hostUsername: user.username,
  hostTimeZone: user.timeZone,
};

type ApiBookingRow = NonNullable<Awaited<ReturnType<ApiBookingRepository["findByUid"]>>>;

function statusCondition(status: BookingListStatus, now: Date): SQL | undefined {
  switch (status) {
    case "upcoming":
      // Cal lists a confirmed recurring occurrence here, but not one still awaiting confirmation.
      return and(
        gte(booking.endTime, now),
        or(
          and(isNotNull(booking.recurringEventId), eq(booking.status, "ACCEPTED")),
          and(isNull(booking.recurringEventId), notInArray(booking.status, [...ENDED]))
        )
      );
    case "recurring":
      return and(
        gte(booking.endTime, now),
        isNotNull(booking.recurringEventId),
        notInArray(booking.status, [...ENDED])
      );
    case "past":
      return and(lte(booking.endTime, now), notInArray(booking.status, [...ENDED]));
    case "cancelled":
      return inArray(booking.status, [...ENDED]);
    case "unconfirmed":
      return and(gte(booking.endTime, now), eq(booking.status, "PENDING"));
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function attendeeMatches(condition: SQL): SQL {
  return sql`${booking.id} in (select ${attendee.bookingId} from ${attendee} where ${condition})`;
}

function listConditions(query: BookingListQuery): SQL[] {
  const conditions: (SQL | undefined)[] = [
    or(
      eq(booking.userId, query.userId),
      attendeeMatches(sql`lower(${attendee.email}) = ${query.email.toLowerCase()}`)
    ),
    query.statuses?.length
      ? or(...query.statuses.map((status) => statusCondition(status, query.now)))
      : undefined,
    query.attendeeEmail
      ? attendeeMatches(sql`lower(${attendee.email}) = ${query.attendeeEmail.toLowerCase()}`)
      : undefined,
    query.attendeeName
      ? attendeeMatches(
          sql`${attendee.name} like ${`%${escapeLike(query.attendeeName)}%`} escape '\\' collate nocase`
        )
      : undefined,
    query.bookingUid ? eq(booking.uid, query.bookingUid) : undefined,
    query.eventTypeIds?.length ? inArray(booking.eventTypeId, query.eventTypeIds) : undefined,
    query.afterStart ? gte(booking.startTime, query.afterStart) : undefined,
    query.beforeEnd ? lte(booking.endTime, query.beforeEnd) : undefined,
    query.afterCreatedAt ? gte(booking.createdAt, query.afterCreatedAt) : undefined,
    query.beforeCreatedAt ? lte(booking.createdAt, query.beforeCreatedAt) : undefined,
    query.afterUpdatedAt ? gte(booking.updatedAt, query.afterUpdatedAt) : undefined,
    query.beforeUpdatedAt ? lte(booking.updatedAt, query.beforeUpdatedAt) : undefined,
  ];
  return conditions.filter((condition): condition is SQL => condition !== undefined);
}

/** Bookings as Cal's public API returns them; the app's own screens read through BookingRepository. */
class ApiBookingRepository {
  constructor(private readonly db: Database) {}

  private select() {
    return this.db
      .select(bookingColumns)
      .from(booking)
      .leftJoin(eventType, eq(eventType.id, booking.eventTypeId))
      .leftJoin(user, eq(user.id, booking.userId));
  }

  async findByUid(uid: string) {
    const [found] = await this.select().where(eq(booking.uid, uid)).limit(1);
    if (!found) return null;
    const [withRelations] = await this.withRelations([found]);
    return withRelations;
  }

  /** Every occurrence of a recurring booking, earliest first. */
  async findSeries(recurringEventId: string) {
    const rows = await this.select()
      .where(eq(booking.recurringEventId, recurringEventId))
      .orderBy(asc(booking.startTime));
    return this.withRelations(rows);
  }

  async findMany(query: BookingListQuery) {
    const where = and(...listConditions(query));
    const order = query.sort.direction === "asc" ? asc : desc;
    const [rows, [total]] = await Promise.all([
      this.select()
        .where(where)
        .orderBy(order(booking[query.sort.column]), asc(booking.id))
        .limit(query.take)
        .offset(query.skip),
      this.db.select({ value: count() }).from(booking).where(where),
    ]);
    return { bookings: await this.withRelations(rows), total: total?.value ?? 0 };
  }

  /** Attendees, and the booking that replaced each one when it was rescheduled. */
  private async withRelations<T extends { id: number; uid: string }>(rows: T[]) {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const [attendees, replacements] = await Promise.all([
      this.db
        .select({
          bookingId: attendee.bookingId,
          name: attendee.name,
          email: attendee.email,
          timeZone: attendee.timeZone,
          locale: attendee.locale,
          phoneNumber: attendee.phoneNumber,
          noShow: attendee.noShow,
        })
        .from(attendee)
        .where(inArray(attendee.bookingId, ids))
        .orderBy(asc(attendee.id)),
      this.db
        .select({ uid: booking.uid, fromReschedule: booking.fromReschedule })
        .from(booking)
        .where(
          inArray(
            booking.fromReschedule,
            rows.map((row) => row.uid)
          )
        ),
    ]);
    const attendeesByBooking = new Map<number, typeof attendees>();
    for (const row of attendees) {
      if (row.bookingId === null) continue;
      attendeesByBooking.set(row.bookingId, [...(attendeesByBooking.get(row.bookingId) ?? []), row]);
    }
    const replacedBy = new Map(replacements.map((row) => [row.fromReschedule, row.uid]));
    return rows.map((row) => ({
      ...row,
      attendees: attendeesByBooking.get(row.id) ?? [],
      rescheduledToUid: replacedBy.get(row.uid) ?? null,
    }));
  }
}

export type { BookingListStatus, BookingListQuery, ApiBookingRow };
export { ApiBookingRepository };
