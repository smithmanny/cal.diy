import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import {
  booking,
  bookingReference,
  credential,
  destinationCalendar,
  selectedCalendar,
} from "@calcom/db/schema";
import { and, eq } from "drizzle-orm";

export const GOOGLE_CALENDAR_TYPE = "google_calendar";

export type CredentialRow = { id: number; userId: number | null; key: unknown; encryptedKey: string | null };

export class CalendarRepository {
  constructor(private readonly db: Database) {}

  findGoogleCredentialsByUserId(userId: number): Promise<CredentialRow[]> {
    return this.db
      .select({
        id: credential.id,
        userId: credential.userId,
        key: credential.key,
        encryptedKey: credential.encryptedKey,
      })
      .from(credential)
      .where(and(eq(credential.userId, userId), eq(credential.type, GOOGLE_CALENDAR_TYPE)));
  }

  async findCredentialById(id: number): Promise<CredentialRow | null> {
    const [found] = await this.db
      .select({
        id: credential.id,
        userId: credential.userId,
        key: credential.key,
        encryptedKey: credential.encryptedKey,
      })
      .from(credential)
      .where(eq(credential.id, id))
      .limit(1);
    return found ?? null;
  }

  async createGoogleCredential(userId: number, encryptedKey: string): Promise<number> {
    const [created] = await this.db
      .insert(credential)
      // The real key lives in encryptedKey; `key` is NOT NULL in Cal's schema.
      .values({ userId, type: GOOGLE_CALENDAR_TYPE, key: {}, encryptedKey })
      .returning({ id: credential.id });
    return created.id;
  }

  async updateCredentialKey(id: number, encryptedKey: string): Promise<void> {
    await this.db
      .update(credential)
      .set({ key: {}, encryptedKey, invalid: false })
      .where(eq(credential.id, id));
  }

  async markCredentialInvalid(id: number): Promise<void> {
    await this.db.update(credential).set({ invalid: true }).where(eq(credential.id, id));
  }

  async deleteCredential(id: number): Promise<void> {
    // SelectedCalendar/DestinationCalendar cascade; booking references keep their history (SET NULL).
    await this.db.delete(credential).where(eq(credential.id, id));
  }

  findSelectedCalendars(userId: number) {
    return this.db
      .select({ credentialId: selectedCalendar.credentialId, externalId: selectedCalendar.externalId })
      .from(selectedCalendar)
      .where(
        and(eq(selectedCalendar.userId, userId), eq(selectedCalendar.integration, GOOGLE_CALENDAR_TYPE))
      );
  }

  async setSelected(
    userId: number,
    credentialId: number,
    externalId: string,
    selected: boolean
  ): Promise<void> {
    const match = and(
      eq(selectedCalendar.userId, userId),
      eq(selectedCalendar.integration, GOOGLE_CALENDAR_TYPE),
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
      credentialId,
      integration: GOOGLE_CALENDAR_TYPE,
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
    credentialId: number,
    externalId: string,
    primaryEmail: string | null
  ): Promise<void> {
    // DestinationCalendar.userId is unique, so this is a per-user upsert.
    await this.db
      .insert(destinationCalendar)
      .values({ userId, credentialId, externalId, integration: GOOGLE_CALENDAR_TYPE, primaryEmail })
      .onConflictDoUpdate({
        target: destinationCalendar.userId,
        set: { credentialId, externalId, integration: GOOGLE_CALENDAR_TYPE, primaryEmail },
      });
  }

  async findReferencesByBookingUid(uid: string) {
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
      .where(and(eq(booking.uid, uid), eq(bookingReference.type, GOOGLE_CALENDAR_TYPE)));
  }

  async addReference(data: {
    bookingUid: string;
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
      type: GOOGLE_CALENDAR_TYPE,
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
