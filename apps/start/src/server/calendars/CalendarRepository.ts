import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { booking, bookingReference, destinationCalendar, selectedCalendar } from "@calcom/db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

/** Selected/destination calendars and calendar booking references, for any calendar provider. */
export class CalendarRepository {
  constructor(private readonly db: Database) {}

  findSelectedCalendars(userId: number) {
    return this.db
      .select({ credentialId: selectedCalendar.credentialId, externalId: selectedCalendar.externalId })
      .from(selectedCalendar)
      .where(eq(selectedCalendar.userId, userId));
  }

  async setSelected(
    userId: number,
    credential: { id: number; type: string },
    externalId: string,
    selected: boolean
  ): Promise<void> {
    const match = and(
      eq(selectedCalendar.userId, userId),
      eq(selectedCalendar.integration, credential.type),
      eq(selectedCalendar.externalId, externalId)
    );
    if (!selected) {
      await this.db.delete(selectedCalendar).where(match);
      return;
    }
    const [existing] = await this.db
      .select({ id: selectedCalendar.id })
      .from(selectedCalendar)
      .where(match)
      .limit(1);
    if (existing) return;
    await this.db.insert(selectedCalendar).values({
      id: crypto.randomUUID(),
      userId,
      credentialId: credential.id,
      integration: credential.type,
      externalId,
    });
  }

  async findDestination(userId: number) {
    const [found] = await this.db
      .select({
        credentialId: destinationCalendar.credentialId,
        externalId: destinationCalendar.externalId,
        integration: destinationCalendar.integration,
      })
      .from(destinationCalendar)
      .where(eq(destinationCalendar.userId, userId))
      .limit(1);
    return found ?? null;
  }

  async setDestination(
    userId: number,
    credential: { id: number; type: string },
    externalId: string,
    primaryEmail: string | null
  ): Promise<void> {
    const values = { credentialId: credential.id, externalId, integration: credential.type, primaryEmail };
    // DestinationCalendar.userId is unique, so this is a per-user upsert.
    await this.db
      .insert(destinationCalendar)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: destinationCalendar.userId, set: values });
  }

  findReferencesByBookingUid(uid: string, types: string[]) {
    return this.db
      .select({
        id: bookingReference.id,
        type: bookingReference.type,
        uid: bookingReference.uid,
        credentialId: bookingReference.credentialId,
        externalCalendarId: bookingReference.externalCalendarId,
      })
      .from(bookingReference)
      .innerJoin(booking, eq(booking.id, bookingReference.bookingId))
      .where(
        and(
          eq(booking.uid, uid),
          inArray(bookingReference.type, types),
          // Events already removed (say, before recreating one with new guests) stay gone.
          or(isNull(bookingReference.deleted), eq(bookingReference.deleted, false))
        )
      );
  }

  async addReference(data: {
    bookingUid: string;
    type: string;
    credentialId: number;
    eventId: string;
    calendarId: string;
    meetingUrl: string | null;
  }) {
    const [found] = await this.db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.uid, data.bookingUid))
      .limit(1);
    if (!found) return;
    await this.db.insert(bookingReference).values({
      type: data.type,
      uid: data.eventId,
      bookingId: found.id,
      credentialId: data.credentialId,
      externalCalendarId: data.calendarId,
      meetingUrl: data.meetingUrl,
      meetingId: data.eventId,
    });
  }

  async markReferenceDeleted(id: number): Promise<void> {
    await this.db.update(bookingReference).set({ deleted: true }).where(eq(bookingReference.id, id));
  }

  async setBookingVideoUrl(uid: string, videoCallUrl: string): Promise<void> {
    await this.db
      .update(booking)
      .set({ location: videoCallUrl, metadata: { videoCallUrl } })
      .where(eq(booking.uid, uid));
  }
}
