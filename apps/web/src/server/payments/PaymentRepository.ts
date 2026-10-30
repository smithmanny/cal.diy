import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import type { JsonValue } from "@calcom/db/ids";
import { booking, eventType, payment, user } from "@calcom/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const paymentColumns = {
  id: payment.id,
  uid: payment.uid,
  amount: payment.amount,
  currency: payment.currency,
  success: payment.success,
  refunded: payment.refunded,
  data: payment.data,
  externalId: payment.externalId,
};

export class PaymentRepository {
  constructor(private readonly db: Database) {}

  async create(data: {
    uid: string;
    bookingUid: string;
    amount: number;
    currency: string;
    externalId: string;
    data: { [key: string]: JsonValue };
  }): Promise<void> {
    const [found] = await this.db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.uid, data.bookingUid))
      .limit(1);
    if (!found) throw new Error(`Booking ${data.bookingUid} not found`);
    await this.db.insert(payment).values({
      uid: data.uid,
      bookingId: found.id,
      amount: data.amount,
      currency: data.currency,
      externalId: data.externalId,
      data: data.data,
      fee: 0,
      success: false,
      refunded: false,
      paymentOption: "ON_BOOKING",
    });
  }

  /** The payment with what the payment page shows about its booking. */
  async findByUidIncludeBooking(uid: string) {
    const [found] = await this.db
      .select({
        ...paymentColumns,
        booking: {
          uid: booking.uid,
          title: booking.title,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          paid: booking.paid,
        },
        eventTypeTitle: eventType.title,
        hostName: user.name,
        hostTimeZone: user.timeZone,
      })
      .from(payment)
      .innerJoin(booking, eq(booking.id, payment.bookingId))
      .leftJoin(eventType, eq(eventType.id, booking.eventTypeId))
      .leftJoin(user, eq(user.id, booking.userId))
      .where(eq(payment.uid, uid))
      .limit(1);
    return found ?? null;
  }

  async findByExternalIdIncludeBooking(externalId: string) {
    const [found] = await this.db
      .select({ ...paymentColumns, bookingUid: booking.uid, bookingStatus: booking.status })
      .from(payment)
      .innerJoin(booking, eq(booking.id, payment.bookingId))
      .where(eq(payment.externalId, externalId))
      .limit(1);
    return found ?? null;
  }

  /** Paid, not yet refunded payments of the booking, with its host and event type's settings. */
  findRefundable(bookingUid: string) {
    return this.db
      .select({
        ...paymentColumns,
        hostId: booking.userId,
        startTime: booking.startTime,
        eventTypeMetadata: eventType.metadata,
      })
      .from(payment)
      .innerJoin(booking, eq(booking.id, payment.bookingId))
      .leftJoin(eventType, eq(eventType.id, booking.eventTypeId))
      .where(and(eq(booking.uid, bookingUid), eq(payment.success, true), eq(payment.refunded, false)));
  }

  /** Points the payment at a new checkout session (the old one expired). */
  async updateCheckout(id: number, externalId: string, data: { [key: string]: JsonValue }): Promise<void> {
    await this.db.update(payment).set({ externalId, data }).where(eq(payment.id, id));
  }

  /** Marks it paid once; false when it already was, so a repeated webhook does nothing. */
  async markSuccess(id: number, data: { [key: string]: JsonValue }): Promise<boolean> {
    const updated = await this.db
      .update(payment)
      .set({ success: true, data })
      .where(and(eq(payment.id, id), eq(payment.success, false)))
      .returning({ id: payment.id });
    return updated.length > 0;
  }

  /** A rescheduled booking keeps what was paid for the one it replaces, as in Cal. */
  async moveToBooking(fromUid: string, toUid: string): Promise<void> {
    const rows = await this.db
      .select({ uid: booking.uid, id: booking.id })
      .from(booking)
      .where(inArray(booking.uid, [fromUid, toUid]));
    const from = rows.find((row) => row.uid === fromUid);
    const to = rows.find((row) => row.uid === toUid);
    if (!from || !to) return;
    const moved = await this.db
      .update(payment)
      .set({ bookingId: to.id })
      .where(and(eq(payment.bookingId, from.id), eq(payment.success, true)))
      .returning({ id: payment.id });
    if (moved.length) await this.db.update(booking).set({ paid: true }).where(eq(booking.id, to.id));
  }

  async markRefunded(id: number): Promise<void> {
    await this.db.update(payment).set({ refunded: true }).where(eq(payment.id, id));
  }
}
