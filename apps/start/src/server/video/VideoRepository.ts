import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { booking, bookingReference } from "@calcom/db/schema";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

export type VideoReference = {
  id: number;
  type: string;
  meetingId: string | null;
  meetingUrl: string | null;
  credentialId: number | null;
};

export class VideoRepository {
  constructor(private readonly db: Database) {}

  /** Live (not deleted) meetings of the booking, of the given types. */
  findReferences(bookingUid: string, types: string[]): Promise<VideoReference[]> {
    return this.db
      .select({
        id: bookingReference.id,
        type: bookingReference.type,
        meetingId: bookingReference.meetingId,
        meetingUrl: bookingReference.meetingUrl,
        credentialId: bookingReference.credentialId,
      })
      .from(bookingReference)
      .innerJoin(booking, eq(booking.id, bookingReference.bookingId))
      .where(
        and(
          eq(booking.uid, bookingUid),
          inArray(bookingReference.type, types),
          or(isNull(bookingReference.deleted), eq(bookingReference.deleted, false))
        )
      );
  }

  async addReference(data: {
    bookingUid: string;
    type: string;
    credentialId: number | null;
    meetingId: string;
    meetingUrl: string;
    meetingPassword: string | null;
  }): Promise<void> {
    const [found] = await this.db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.uid, data.bookingUid))
      .limit(1);
    if (!found) return;
    await this.db.insert(bookingReference).values({
      type: data.type,
      uid: data.meetingId,
      meetingId: data.meetingId,
      meetingUrl: data.meetingUrl,
      meetingPassword: data.meetingPassword,
      bookingId: found.id,
      credentialId: data.credentialId,
    });
  }

  async markReferenceDeleted(id: number): Promise<void> {
    await this.db.update(bookingReference).set({ deleted: true }).where(eq(bookingReference.id, id));
  }

  /** Cal keeps the join link in metadata.videoCallUrl; the location shows it too. */
  async setBookingVideoUrl(uid: string, videoCallUrl: string): Promise<void> {
    await this.db
      .update(booking)
      .set({
        location: videoCallUrl,
        metadata: sql`json_set(coalesce(${booking.metadata}, '{}'), '$.videoCallUrl', ${videoCallUrl})`,
      })
      .where(eq(booking.uid, uid));
  }

  /** Where /video/<uid> sends people: the booking's live Cal Video room, unless it's cancelled. */
  async findRoomUrl(bookingUid: string, type: string): Promise<string | null> {
    const [found] = await this.db
      .select({ url: bookingReference.meetingUrl, status: booking.status })
      .from(bookingReference)
      .innerJoin(booking, eq(booking.id, bookingReference.bookingId))
      .where(
        and(
          eq(booking.uid, bookingUid),
          eq(bookingReference.type, type),
          or(isNull(bookingReference.deleted), eq(bookingReference.deleted, false))
        )
      )
      .limit(1);
    if (!found || found.status === "CANCELLED" || found.status === "REJECTED") return null;
    return found.url;
  }
}
