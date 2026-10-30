import "@tanstack/react-start/server-only";
import { conditionalInsert } from "@calcom/db/conditional-insert";
import type { Database } from "@calcom/db/database";
import type { BookingStatus } from "@calcom/db/enums";
import type { JsonValue } from "@calcom/db/ids";
import { attendee, booking, bookingSeat, eventType, team, user } from "@calcom/db/schema";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notExists,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { appearanceColumns } from "../users/UserRepository";

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
  cancelledBy: booking.cancelledBy,
  rejectionReason: booking.rejectionReason,
  rescheduled: booking.rescheduled,
  fromReschedule: booking.fromReschedule,
  userId: booking.userId,
  eventTypeId: booking.eventTypeId,
  metadata: booking.metadata,
  recurringEventId: booking.recurringEventId,
};

/** Accepted bookings, and pending ones whose event type says unconfirmed bookings block the slot. */
function blocksTime(db: Database): SQL | undefined {
  return or(
    eq(booking.status, "ACCEPTED"),
    and(
      eq(booking.status, "PENDING"),
      exists(
        db
          .select({ one: sql`1` })
          .from(eventType)
          .where(
            and(eq(eventType.id, booking.eventTypeId), eq(eventType.requiresConfirmationWillBlockSlot, true))
          )
      )
    )
  );
}

export type NewBooking = {
  uid: string;
  userId: number;
  userPrimaryEmail: string;
  eventTypeId: number | null;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  location: string | null;
  status: BookingStatus;
  responses: { [key: string]: JsonValue };
  fromReschedule: string | null;
  /** Shared by every occurrence of a recurring booking. */
  recurringEventId: string | null;
  /** The booker first, then any guests they added. */
  attendees: [NewAttendee, ...NewAttendee[]];
  /** For seated events, the booker's seat (BookingSeat.referenceUid) and their answers. */
  seat?: { referenceUid: string; data: { [key: string]: JsonValue } };
};

export type NewAttendee = {
  name: string;
  email: string;
  timeZone: string;
  locale: string;
  phoneNumber: string | null;
};

export type HostBookingFilter = "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed";

export type HostBookingSearch = {
  eventTypeIds?: number[];
  /** Part of an attendee's name or email. */
  attendee?: string;
  from?: Date;
  to?: Date;
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
    excludeEventTypeId,
  }: {
    userId: number;
    email: string;
    from: Date;
    to: Date;
    excludeUid?: string;
    /** A seated event's own bookings, which it checks seat by seat instead. */
    excludeEventTypeId?: number;
  }) {
    const overlaps = and(
      or(
        eq(booking.status, "ACCEPTED"),
        and(eq(booking.status, "PENDING"), eq(eventType.requiresConfirmationWillBlockSlot, true))
      ),
      lt(booking.startTime, to),
      gt(booking.endTime, from),
      excludeUid ? ne(booking.uid, excludeUid) : undefined,
      excludeEventTypeId
        ? or(isNull(booking.eventTypeId), ne(booking.eventTypeId, excludeEventTypeId))
        : undefined
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
   * Inserts the booking and its attendees only if no booking that blocks time overlaps it.
   * The check and the insert are one statement (see conditionalInsert) because D1 can't hold a
   * transaction open; the attendee insert in the same batch finds the booking by its pre-generated
   * uid. Returns false when the slot was taken in the meantime.
   */
  async insertIfSlotFree(data: NewBooking, options: { replacesUid?: string } = {}): Promise<boolean> {
    return this.insertSeriesIfFirstSlotFree([data], options);
  }

  /**
   * A recurring booking's occurrences, all or none: the first is inserted only if its slot is free
   * (like Cal, which checks availability for the first occurrence), the rest only if the first was.
   */
  async insertSeriesIfFirstSlotFree(
    bookings: [NewBooking, ...NewBooking[]],
    options: { replacesUid?: string } = {}
  ): Promise<boolean> {
    const [first] = bookings;
    const slotIsFree = notExists(
      this.db
        .select({ one: sql`1` })
        .from(booking)
        .where(
          and(
            eq(booking.userId, first.userId),
            blocksTime(this.db),
            lt(booking.startTime, first.endTime),
            gt(booking.endTime, first.startTime),
            // A reschedule may overlap the booking it replaces.
            options.replacesUid ? ne(booking.uid, options.replacesUid) : undefined
          )
        )
    );
    // A booking is replaced once: a second reschedule of it (say, after the host asked for one) loses.
    const notYetReplaced = options.replacesUid
      ? notExists(
          this.db.select({ one: sql`1` }).from(booking).where(eq(booking.fromReschedule, options.replacesUid))
        )
      : undefined;
    const inserted = (uid: string) =>
      this.db.select({ id: booking.id }).from(booking).where(eq(booking.uid, uid));
    const firstInserted = inserted(first.uid);
    const statements = bookings.flatMap(({ attendees: newAttendees, seat, ...bookingValues }, index) => {
      const insertedBooking = inserted(bookingValues.uid);
      return [
        this.db.run(
          conditionalInsert(
            booking,
            { ...bookingValues, iCalUID: `${bookingValues.uid}@cal.diy` },
            index === 0 ? (and(slotIsFree, notYetReplaced) ?? slotIsFree) : exists(firstInserted)
          )
        ),
        ...newAttendees.map((newAttendee) =>
          this.db.run(
            conditionalInsert(
              attendee,
              {
                ...newAttendee,
                email: newAttendee.email.toLowerCase(),
                bookingId: sql`(${insertedBooking})`,
              },
              exists(insertedBooking)
            )
          )
        ),
        ...(seat ? [this.insertSeatStatement(insertedBooking, newAttendees[0].email, seat)] : []),
      ];
    });
    const [head, ...tail] = statements;
    await this.db.batch([
      head,
      ...tail,
      // Cancelling the original in the same batch means a reschedule never leaves two live bookings.
      this.db
        .update(booking)
        .set({ status: "CANCELLED", rescheduled: true })
        .where(and(eq(booking.uid, options.replacesUid ?? ""), exists(firstInserted))),
    ]);
    const [created] = await firstInserted.limit(1);
    return Boolean(created);
  }

  private insertSeatStatement(
    insertedBooking: ReturnType<BookingRepository["bookingIdByUid"]>,
    email: string,
    seat: NonNullable<NewBooking["seat"]>
  ) {
    const seatedAttendee = this.db
      .select({ id: attendee.id })
      .from(attendee)
      .where(and(eq(attendee.bookingId, sql`(${insertedBooking})`), eq(attendee.email, email.toLowerCase())));
    return this.db.run(
      conditionalInsert(
        bookingSeat,
        {
          referenceUid: seat.referenceUid,
          bookingId: sql`(${insertedBooking})`,
          attendeeId: sql`(${seatedAttendee})`,
          data: seat.data,
        },
        exists(seatedAttendee)
      )
    );
  }

  private bookingIdByUid(uid: string) {
    return this.db.select({ id: booking.id }).from(booking).where(eq(booking.uid, uid));
  }

  private unseatedAttendee(bookingId: ReturnType<BookingRepository["bookingIdByUid"]>, email: string) {
    return this.db
      .select({ id: attendee.id })
      .from(attendee)
      .where(
        and(
          eq(attendee.bookingId, sql`(${bookingId})`),
          eq(attendee.email, email),
          // Qualified by hand: Drizzle would leave "id" unqualified, matching the seat's own id.
          sql`not exists (select 1 from "BookingSeat" where "BookingSeat"."attendeeId" = "Attendee"."id")`
        )
      );
  }

  /**
   * Adds a booker to a seated booking, only while it is accepted, has a free seat and doesn't
   * already have them. The check and the insert are one statement, so two bookers can't both
   * take the last seat. Returns false when the seat couldn't be taken.
   */
  async addSeat(
    bookingUid: string,
    newAttendee: NewAttendee,
    seat: NonNullable<NewBooking["seat"]>,
    seatsPerTimeSlot: number
  ): Promise<boolean> {
    const bookingId = this.bookingIdByUid(bookingUid);
    const email = newAttendee.email.toLowerCase();
    const seatsTaken = this.db
      .select({ count: sql<number>`count(*)` })
      .from(bookingSeat)
      .where(eq(bookingSeat.bookingId, sql`(${bookingId})`));
    const hasRoom = sql.join(
      [
        exists(
          this.db
            .select({ one: sql`1` })
            .from(booking)
            .where(and(eq(booking.uid, bookingUid), eq(booking.status, "ACCEPTED")))
        ),
        sql`(${seatsTaken}) < ${seatsPerTimeSlot}`,
        notExists(
          this.db
            .select({ one: sql`1` })
            .from(attendee)
            .where(and(eq(attendee.bookingId, sql`(${bookingId})`), eq(attendee.email, email)))
        ),
      ],
      sql` and `
    );
    const unseated = this.unseatedAttendee(bookingId, email);
    await this.db.batch([
      this.db.run(
        conditionalInsert(attendee, { ...newAttendee, email, bookingId: sql`(${bookingId})` }, hasRoom)
      ),
      // Only the attendee row just added has no seat yet.
      this.db.run(
        conditionalInsert(
          bookingSeat,
          {
            referenceUid: seat.referenceUid,
            bookingId: sql`(${bookingId})`,
            attendeeId: sql`(${unseated})`,
            data: seat.data,
          },
          exists(unseated)
        )
      ),
    ]);
    return Boolean(await this.findSeat(seat.referenceUid));
  }

  async findSeat(referenceUid: string) {
    const [found] = await this.db
      .select({
        referenceUid: bookingSeat.referenceUid,
        attendeeId: bookingSeat.attendeeId,
        bookingUid: booking.uid,
        email: attendee.email,
        name: attendee.name,
        timeZone: attendee.timeZone,
        data: bookingSeat.data,
      })
      .from(bookingSeat)
      .innerJoin(booking, eq(booking.id, bookingSeat.bookingId))
      .innerJoin(attendee, eq(attendee.id, bookingSeat.attendeeId))
      .where(eq(bookingSeat.referenceUid, referenceUid))
      .limit(1);
    return found ?? null;
  }

  async countSeats(bookingUid: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(bookingSeat)
      .where(eq(bookingSeat.bookingId, sql`(${this.bookingIdByUid(bookingUid)})`));
    return Number(row?.count ?? 0);
  }

  /** Frees a seat; the BookingSeat row goes with its attendee. */
  async removeAttendee(attendeeId: number): Promise<void> {
    await this.db.delete(attendee).where(eq(attendee.id, attendeeId));
  }

  /** A seated event's accepted bookings overlapping [from, to], with how many seats each has taken. */
  findSeatedForEventType({ eventTypeId, from, to }: { eventTypeId: number; from: Date; to: Date }) {
    return this.db
      .select({
        uid: booking.uid,
        start: booking.startTime,
        end: booking.endTime,
        // Spelled out: inside a single-table select Drizzle leaves column names unqualified, which
        // would compare the seat's own id here.
        seatsTaken: sql<number>`(select count(*) from "BookingSeat" where "BookingSeat"."bookingId" = "Booking"."id")`,
      })
      .from(booking)
      .where(
        and(
          eq(booking.eventTypeId, eventTypeId),
          eq(booking.status, "ACCEPTED"),
          lt(booking.startTime, to),
          gt(booking.endTime, from)
        )
      );
  }

  /** The other bookings of a recurring series, oldest first. */
  findSeries(recurringEventId: string) {
    return this.db
      .select({
        uid: booking.uid,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      })
      .from(booking)
      .where(eq(booking.recurringEventId, recurringEventId))
      .orderBy(asc(booking.startTime));
  }

  /** The event type's accepted bookings starting in [from, to], for booking and duration limits. */
  findAcceptedTimesForEventType({
    eventTypeId,
    from,
    to,
    excludeUid,
  }: {
    eventTypeId: number;
    from: Date;
    to: Date;
    excludeUid?: string;
  }) {
    return this.db
      .select({ start: booking.startTime, end: booking.endTime })
      .from(booking)
      .where(
        and(
          eq(booking.eventTypeId, eventTypeId),
          eq(booking.status, "ACCEPTED"),
          gte(booking.startTime, from),
          lte(booking.startTime, to),
          excludeUid ? ne(booking.uid, excludeUid) : undefined
        )
      );
  }

  /** Upcoming accepted bookings of an event type that `email` attends, latest first. */
  findUpcomingForAttendee({
    eventTypeId,
    email,
    now,
    limit,
  }: {
    eventTypeId: number;
    email: string;
    now: Date;
    limit: number;
  }) {
    return this.db
      .select({ uid: booking.uid, startTime: booking.startTime })
      .from(booking)
      .where(
        and(
          eq(booking.eventTypeId, eventTypeId),
          eq(booking.status, "ACCEPTED"),
          gte(booking.startTime, now),
          inArray(
            booking.id,
            this.db
              .select({ id: attendee.bookingId })
              .from(attendee)
              .where(eq(attendee.email, email.toLowerCase()))
          )
        )
      )
      .orderBy(desc(booking.startTime))
      .limit(limit);
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
              ...appearanceColumns,
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
              teamSlug: team.slug,
              teamId: eventType.teamId,
              bookingFields: eventType.bookingFields,
              disableGuests: eventType.disableGuests,
              disableCancelling: eventType.disableCancelling,
              recurringEvent: eventType.recurringEvent,
              seatsPerTimeSlot: eventType.seatsPerTimeSlot,
              seatsShowAttendees: eventType.seatsShowAttendees,
              disableRescheduling: eventType.disableRescheduling,
              minimumRescheduleNotice: eventType.minimumRescheduleNotice,
              hideCalendarNotes: eventType.hideCalendarNotes,
              hideCalendarEventDetails: eventType.hideCalendarEventDetails,
              hideOrganizerEmail: eventType.hideOrganizerEmail,
              metadata: eventType.metadata,
            })
            .from(eventType)
            .leftJoin(team, eq(team.id, eventType.teamId))
            .where(eq(eventType.id, found.eventTypeId))
            .limit(1)
        : [],
      this.db
        .select({
          name: attendee.name,
          email: attendee.email,
          timeZone: attendee.timeZone,
          phoneNumber: attendee.phoneNumber,
          locale: attendee.locale,
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
      paid?: boolean;
    }
  ) {
    await this.updateStatusMany([uid], data);
  }

  async updateStatusMany(
    uids: string[],
    data: {
      status: BookingStatus;
      cancellationReason?: string | null;
      rejectionReason?: string | null;
      rescheduled?: boolean;
      cancelledBy?: string | null;
      paid?: boolean;
    }
  ) {
    if (uids.length) await this.db.update(booking).set(data).where(inArray(booking.uid, uids));
  }

  /** When each user last took a live booking of this event type (when it was made, as Cal ranks). */
  async findLastBookedAt(eventTypeId: number, userIds: number[]): Promise<Map<number, Date>> {
    if (!userIds.length) return new Map();
    const rows = await this.db
      .select({ userId: booking.userId, last: sql<number>`max(${booking.createdAt})` })
      .from(booking)
      .where(
        and(
          eq(booking.eventTypeId, eventTypeId),
          inArray(booking.userId, userIds),
          inArray(booking.status, ["ACCEPTED", "PENDING"])
        )
      )
      .groupBy(booking.userId);
    return new Map(
      rows.flatMap((row) => (row.userId === null ? [] : [[row.userId, new Date(Number(row.last))]]))
    );
  }

  async hasReplacement(uid: string): Promise<boolean> {
    const [found] = await this.db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.fromReschedule, uid))
      .limit(1);
    return Boolean(found);
  }

  /** Adds attendees and records them in the booking's `guests` response, as Cal does. */
  async addAttendees(bookingId: number, attendees: NewAttendee[], responses: { [key: string]: JsonValue }) {
    const [first, ...rest] = attendees;
    if (!first) return;
    await this.db.batch([
      this.db
        .insert(attendee)
        .values([first, ...rest].map((added) => ({ ...added, email: added.email.toLowerCase(), bookingId }))),
      this.db.update(booking).set({ responses }).where(eq(booking.id, bookingId)),
    ]);
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
    email,
    filter,
    search = {},
    now,
    limit,
  }: {
    userId: number;
    /** Bookings this user attends, like a group link's other members, are listed too. */
    email: string;
    filter: HostBookingFilter;
    search?: HostBookingSearch;
    now: Date;
    limit: number;
  }) {
    const conditions: Record<typeof filter, SQL | undefined> = {
      recurring: and(
        gt(booking.endTime, now),
        isNotNull(booking.recurringEventId),
        inArray(booking.status, ["ACCEPTED", "PENDING"])
      ),
      upcoming: and(gt(booking.endTime, now), eq(booking.status, "ACCEPTED")),
      past: and(lt(booking.endTime, now), inArray(booking.status, ["ACCEPTED", "PENDING"])),
      cancelled: inArray(booking.status, ["CANCELLED", "REJECTED"]),
      unconfirmed: and(gt(booking.endTime, now), eq(booking.status, "PENDING")),
    };
    const order =
      filter === "upcoming" || filter === "unconfirmed" || filter === "recurring"
        ? asc(booking.startTime)
        : desc(booking.startTime);
    const rows = await this.db
      .select({
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        location: booking.location,
        eventTypeTitle: eventType.title,
        eventTypeColor: eventType.eventTypeColor,
        recurringEventId: booking.recurringEventId,
        recurringEvent: eventType.recurringEvent,
        userId: booking.userId,
        id: booking.id,
      })
      .from(booking)
      .leftJoin(eventType, eq(eventType.id, booking.eventTypeId))
      .where(
        and(
          or(
            eq(booking.userId, userId),
            inArray(
              booking.id,
              this.db
                .select({ id: attendee.bookingId })
                .from(attendee)
                .where(eq(attendee.email, email.toLowerCase()))
            )
          ),
          conditions[filter],
          this.searchConditions(search)
        )
      )
      .orderBy(order)
      .limit(limit);
    if (!rows.length) return [];
    const attendees = await this.db
      .select({
        bookingId: attendee.bookingId,
        name: attendee.name,
        email: attendee.email,
        noShow: attendee.noShow,
      })
      .from(attendee)
      .where(
        inArray(
          attendee.bookingId,
          rows.map((row) => row.id)
        )
      )
      .orderBy(asc(attendee.id));
    const byBooking = new Map<number, { name: string; email: string; noShow: boolean }[]>();
    for (const { bookingId, noShow, ...rest } of attendees) {
      if (bookingId === null) continue;
      byBooking.set(bookingId, [...(byBooking.get(bookingId) ?? []), { ...rest, noShow: Boolean(noShow) }]);
    }
    return rows.map(({ id, ...row }) => ({ ...row, attendees: byBooking.get(id) ?? [] }));
  }

  private searchConditions({ eventTypeIds, attendee: text, from, to }: HostBookingSearch): SQL | undefined {
    const pattern = text ? `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%` : null;
    return and(
      eventTypeIds?.length ? inArray(booking.eventTypeId, eventTypeIds) : undefined,
      from ? gte(booking.endTime, from) : undefined,
      to ? lte(booking.startTime, to) : undefined,
      pattern
        ? exists(
            this.db
              .select({ one: sql`1` })
              .from(attendee)
              .where(
                and(
                  eq(attendee.bookingId, booking.id),
                  // SQLite's LIKE ignores ASCII case.
                  or(
                    sql`${attendee.name} LIKE ${pattern} ESCAPE '\\'`,
                    sql`${attendee.email} LIKE ${pattern} ESCAPE '\\'`
                  )
                )
              )
          )
        : undefined
    );
  }

  /** Sets attendees' no-show flags by email; returns the attendees that exist on the booking. */
  async setAttendeesNoShow(bookingId: number, updates: { email: string; noShow: boolean }[]) {
    const current = await this.db
      .select({ id: attendee.id, email: attendee.email })
      .from(attendee)
      .where(
        and(
          eq(attendee.bookingId, bookingId),
          inArray(
            attendee.email,
            updates.map((update) => update.email)
          )
        )
      );
    const ids = new Map(current.map((row) => [row.email, row.id]));
    const applied = updates.filter((update) => ids.has(update.email));
    const [first, ...rest] = applied.map((update) =>
      this.db
        .update(attendee)
        .set({ noShow: update.noShow })
        .where(eq(attendee.id, ids.get(update.email) ?? 0))
    );
    if (first) await this.db.batch([first, ...rest]);
    return applied;
  }
}
