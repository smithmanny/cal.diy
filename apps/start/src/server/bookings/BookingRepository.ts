import "@tanstack/react-start/server-only";
import { conditionalInsert } from "@calcom/db/conditional-insert";
import type { Database } from "@calcom/db/database";
import type { BookingStatus } from "@calcom/db/enums";
import type { JsonValue } from "@calcom/db/ids";
import { attendee, booking, eventType, user } from "@calcom/db/schema";
import { and, asc, desc, eq, exists, gt, inArray, lt, ne, notExists, or, type SQL, sql } from "drizzle-orm";

const detailColumns = {
  id: booking.id,
  uid: booking.uid,
  title: booking.title,
  description: booking.description,
  startTime: booking.startTime,
  endTime: booking.endTime,
  location: booking.location,
  status: booking.status,
  responses: booking.responses,
  cancellationReason: booking.cancellationReason,
  rescheduled: booking.rescheduled,
  fromReschedule: booking.fromReschedule,
  userId: booking.userId,
  eventTypeId: booking.eventTypeId,
  metadata: booking.metadata,
};

export type NewBooking = {
  uid: string;
  userId: number;
  userPrimaryEmail: string;
  eventTypeId: number;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  location: string | null;
  status: BookingStatus;
  responses: { [key: string]: JsonValue };
  fromReschedule: string | null;
  attendee: { name: string; email: string; timeZone: string; locale: string; phoneNumber: string | null };
};

export type BusyBooking = { start: Date; end: Date; beforeBuffer: number; afterBuffer: number };

export class BookingRepository {
  constructor(private readonly db: Database) {}

  /**
   * ACCEPTED bookings the user is in, as host or as an attendee (Cal does the same, so booking
   * someone else's event blocks your own calendar), with the buffers of the event they belong to.
   */
  async findBusyForUser({
    userId,
    email,
    from,
    to,
    excludeUid,
  }: {
    userId: number;
    email: string;
    from: Date;
    to: Date;
    excludeUid?: string;
  }) {
    const overlaps = and(
      eq(booking.status, "ACCEPTED"),
      lt(booking.startTime, to),
      gt(booking.endTime, from),
      excludeUid ? ne(booking.uid, excludeUid) : undefined
    );
    const asAttendee = this.db
      .select({ id: attendee.bookingId })
      .from(attendee)
      .where(eq(attendee.email, email.toLowerCase()));
    const rows = await this.db
      .select({
        start: booking.startTime,
        end: booking.endTime,
        beforeBuffer: eventType.beforeEventBuffer,
        afterBuffer: eventType.afterEventBuffer,
      })
      .from(booking)
      .leftJoin(eventType, eq(eventType.id, booking.eventTypeId))
      .where(and(overlaps, or(eq(booking.userId, userId), inArray(booking.id, asAttendee))));
    return rows.map((row) => ({
      ...row,
      beforeBuffer: row.beforeBuffer ?? 0,
      afterBuffer: row.afterBuffer ?? 0,
    }));
  }

  /**
   * Inserts the booking and its attendee only if the host has no ACCEPTED booking overlapping it.
   * The check and the insert are one statement (see conditionalInsert) because D1 can't hold a
   * transaction open; the attendee insert in the same batch finds the booking by its pre-generated
   * uid. Returns false when the slot was taken in the meantime.
   */
  async insertIfSlotFree(data: NewBooking, options: { replacesUid?: string } = {}): Promise<boolean> {
    const { attendee: newAttendee, ...bookingValues } = data;
    const slotIsFree = notExists(
      this.db
        .select({ one: sql`1` })
        .from(booking)
        .where(
          and(
            eq(booking.userId, data.userId),
            eq(booking.status, "ACCEPTED"),
            lt(booking.startTime, data.endTime),
            gt(booking.endTime, data.startTime),
            // A reschedule may overlap the booking it replaces.
            options.replacesUid ? ne(booking.uid, options.replacesUid) : undefined
          )
        )
    );
    const insertedBooking = this.db.select({ id: booking.id }).from(booking).where(eq(booking.uid, data.uid));
    await this.db.batch([
      this.db.run(
        conditionalInsert(booking, { ...bookingValues, iCalUID: `${data.uid}@cal.diy` }, slotIsFree)
      ),
      this.db.run(
        conditionalInsert(
          attendee,
          { ...newAttendee, email: newAttendee.email.toLowerCase(), bookingId: sql`(${insertedBooking})` },
          exists(insertedBooking)
        )
      ),
      // Cancelling the original in the same batch means a reschedule never leaves two live bookings.
      this.db
        .update(booking)
        .set({ status: "CANCELLED", rescheduled: true })
        .where(and(eq(booking.uid, options.replacesUid ?? ""), exists(insertedBooking))),
    ]);
    const [created] = await insertedBooking.limit(1);
    return Boolean(created);
  }

  async findByUid(uid: string) {
    const [found] = await this.db.select(detailColumns).from(booking).where(eq(booking.uid, uid)).limit(1);
    if (!found) return null;
    const [host, type, attendees] = await Promise.all([
      found.userId
        ? this.db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              username: user.username,
              timeZone: user.timeZone,
              locale: user.locale,
            })
            .from(user)
            .where(eq(user.id, found.userId))
            .limit(1)
        : [],
      found.eventTypeId
        ? this.db
            .select({
              id: eventType.id,
              title: eventType.title,
              slug: eventType.slug,
              length: eventType.length,
            })
            .from(eventType)
            .where(eq(eventType.id, found.eventTypeId))
            .limit(1)
        : [],
      this.db
        .select({
          name: attendee.name,
          email: attendee.email,
          timeZone: attendee.timeZone,
          phoneNumber: attendee.phoneNumber,
        })
        .from(attendee)
        .where(eq(attendee.bookingId, found.id))
        .orderBy(asc(attendee.id)),
    ]);
    return { ...found, host: host[0] ?? null, eventType: type[0] ?? null, attendees };
  }

  async updateStatus(
    uid: string,
    data: {
      status: BookingStatus;
      cancellationReason?: string | null;
      rejectionReason?: string | null;
      rescheduled?: boolean;
      cancelledBy?: string | null;
    }
  ) {
    await this.db.update(booking).set(data).where(eq(booking.uid, uid));
  }

  async updateLocationAndMetadata(
    uid: string,
    data: { location?: string | null; metadata?: { [key: string]: JsonValue } }
  ) {
    await this.db.update(booking).set(data).where(eq(booking.uid, uid));
  }

  /** Bookings where the user is the host, newest-relevant first, for the bookings list. */
  async findManyForHost({
    userId,
    filter,
    now,
    limit,
  }: {
    userId: number;
    filter: "upcoming" | "past" | "cancelled" | "unconfirmed";
    now: Date;
    limit: number;
  }) {
    const conditions: Record<typeof filter, SQL | undefined> = {
      upcoming: and(gt(booking.endTime, now), eq(booking.status, "ACCEPTED")),
      past: and(lt(booking.endTime, now), inArray(booking.status, ["ACCEPTED", "PENDING"])),
      cancelled: inArray(booking.status, ["CANCELLED", "REJECTED"]),
      unconfirmed: and(gt(booking.endTime, now), eq(booking.status, "PENDING")),
    };
    const order =
      filter === "upcoming" || filter === "unconfirmed" ? asc(booking.startTime) : desc(booking.startTime);
    const rows = await this.db
      .select({
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        location: booking.location,
        eventTypeTitle: eventType.title,
        id: booking.id,
      })
      .from(booking)
      .leftJoin(eventType, eq(eventType.id, booking.eventTypeId))
      .where(and(eq(booking.userId, userId), conditions[filter]))
      .orderBy(order)
      .limit(limit);
    if (!rows.length) return [];
    const attendees = await this.db
      .select({ bookingId: attendee.bookingId, name: attendee.name, email: attendee.email })
      .from(attendee)
      .where(
        inArray(
          attendee.bookingId,
          rows.map((row) => row.id)
        )
      );
    const byBooking = new Map<number, { name: string; email: string }[]>();
    for (const { bookingId, ...rest } of attendees) {
      if (bookingId === null) continue;
      byBooking.set(bookingId, [...(byBooking.get(bookingId) ?? []), rest]);
    }
    return rows.map(({ id, ...row }) => ({ ...row, attendees: byBooking.get(id) ?? [] }));
  }
}
