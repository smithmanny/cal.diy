import "@tanstack/react-start/server-only";

import type { CredentialRepository, CredentialRow } from "../apps/CredentialRepository";
import type { CredentialVault } from "../apps/CredentialVault";
import type { BookingEvent, BookingSnapshot } from "../bookings/events";
import { AppError } from "../errors";
import type { VideoClient, VideoProvider } from "./types";
import type { VideoRepository } from "./VideoRepository";

export type VideoServiceConfig = { providers: VideoProvider[]; vault: CredentialVault };

/**
 * Creates a meeting when a booking's location is a conferencing app (Zoom, Teams, Cal Video,
 * Jitsi), and removes it when the booking moves or ends. Runs before calendar sync, so the
 * calendar event, webhooks and emails all carry the join link.
 */
export class VideoService {
  private readonly byType: Map<string, VideoProvider>;
  private readonly byLocation: Map<string, VideoProvider>;

  constructor(
    private readonly repo: VideoRepository,
    private readonly credentials: CredentialRepository,
    private readonly config: VideoServiceConfig
  ) {
    this.byType = new Map(config.providers.map((provider) => [provider.type, provider]));
    this.byLocation = new Map(config.providers.map((provider) => [provider.locationType, provider]));
  }

  hasProvider(type: string): boolean {
    return this.byType.has(type);
  }

  async connectOAuth(userId: number, type: string, code: string): Promise<void> {
    const exchange = this.byType.get(type)?.exchangeCode;
    if (!exchange) throw new AppError("not_found", 404);
    const key = await exchange(code);
    await this.credentials.create(userId, type, await this.config.vault.seal(key));
  }

  roomUrl(bookingUid: string, type: string): Promise<string | null> {
    return this.repo.findRoomUrl(bookingUid, type);
  }

  async onBookingEvent(event: BookingEvent): Promise<void> {
    // One meeting serves every seat of a seated booking.
    if (event.seat) {
      if (event.type !== "BOOKING_CANCELLED") await this.createMeeting(event.booking);
      return;
    }
    switch (event.type) {
      case "BOOKING_CREATED":
        await this.createMeeting(event.booking);
        return;
      case "BOOKING_RESCHEDULED":
        if (event.rescheduledFrom) await this.deleteMeetings(event.rescheduledFrom.uid);
        await this.createMeeting(event.booking);
        return;
      case "BOOKING_CANCELLED":
      case "BOOKING_REJECTED":
        await this.deleteMeetings(event.booking.uid);
        return;
      default:
        // BOOKING_REQUESTED: like calendar events, the meeting waits for the host to confirm.
        return;
    }
  }

  private async createMeeting(booking: BookingSnapshot): Promise<void> {
    const provider = booking.location ? this.byLocation.get(booking.location) : undefined;
    if (!provider) return;
    if ((await this.repo.findReferences(booking.uid, [provider.type])).length) return;
    const row = provider.needsCredential
      ? (await this.credentials.findByUserId(booking.organizer.id, [provider.type]))[0]
      : undefined;
    if (provider.needsCredential && !row) {
      console.error(`Booking ${booking.uid} asks for ${provider.type}, which its host hasn't installed`);
      return;
    }
    const client = await this.clientFor(provider, row);
    const meeting = await client.createMeeting({
      uid: booking.uid,
      title: booking.title,
      description: booking.description ?? booking.eventType?.title ?? booking.title,
      start: booking.startTime,
      end: booking.endTime,
      timeZone: booking.organizer.timeZone,
      attendees: booking.attendees.map(({ name, email }) => ({ name, email })),
    });
    await this.repo.addReference({
      bookingUid: booking.uid,
      type: provider.type,
      credentialId: row?.id ?? null,
      meetingId: meeting.id,
      meetingUrl: meeting.url,
      meetingPassword: meeting.password,
    });
    const link = provider.publicLink?.(booking.uid) ?? meeting.url;
    await this.repo.setBookingVideoUrl(booking.uid, link);
    // Listeners run in order; calendar sync, webhooks and emails should see the real link.
    booking.location = link;
  }

  private async deleteMeetings(bookingUid: string): Promise<void> {
    for (const reference of await this.repo.findReferences(bookingUid, [...this.byType.keys()])) {
      const provider = this.byType.get(reference.type);
      if (!provider || !reference.meetingId) continue;
      const row = reference.credentialId ? await this.credentials.findById(reference.credentialId) : null;
      // The host removed the app since; there is nothing left to call.
      if (provider.needsCredential && !row) continue;
      await (await this.clientFor(provider, row ?? undefined)).deleteMeeting(reference.meetingId);
      await this.repo.markReferenceDeleted(reference.id);
    }
  }

  private async clientFor(provider: VideoProvider, row: CredentialRow | undefined): Promise<VideoClient> {
    if (!row) return provider.open(null, async () => {});
    return provider.open(await this.config.vault.open(row), async (key) =>
      this.credentials.updateKey(row.id, await this.config.vault.seal(key))
    );
  }
}
