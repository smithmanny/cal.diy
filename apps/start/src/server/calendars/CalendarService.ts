import "@tanstack/react-start/server-only";

import type { BusyInterval } from "@calcom/scheduling/available-slots";
import type { BookingEvent, BookingSnapshot } from "../bookings/events";
import { symmetricDecrypt, symmetricEncrypt } from "../crypto/symmetric";
import { AppError } from "../errors";
import type { CalendarRepository, CredentialRow } from "./CalendarRepository";
import { GoogleCalendarClient } from "./google/GoogleCalendarClient";
import { exchangeCode, type GoogleOAuthConfig, type GoogleTokens } from "./google/oauth";

export type CalendarServiceConfig = {
  oauth: GoogleOAuthConfig;
  encryptionKey: string;
  /** Public origin, for the manage-booking link in event descriptions. */
  publicUrl: string;
  fetchImpl?: typeof fetch;
};

export type ConnectedCalendarDto = {
  credentialId: number;
  error: boolean;
  calendars: { id: string; name: string; primary: boolean; selected: boolean; destination: boolean }[];
};

const GOOGLE_MEET = "integrations:google:meet";

export class CalendarService {
  constructor(
    private readonly repo: CalendarRepository,
    private readonly config: CalendarServiceConfig
  ) {}

  async connect(userId: number, code: string): Promise<void> {
    const tokens = await exchangeCode(this.config.oauth, code, this.config.fetchImpl);
    const credentialId = await this.repo.createGoogleCredential(userId, await this.seal(tokens));
    const client = await this.clientFor({
      id: credentialId,
      userId,
      key: {},
      encryptedKey: await this.seal(tokens),
    });
    const primary = (await client.listCalendars()).find((calendar) => calendar.primary);
    if (!primary) return;
    // Like Cal: check the primary calendar for conflicts, and write new events there unless a destination exists.
    await this.repo.setSelected(userId, credentialId, primary.id, true);
    if (!(await this.repo.findDestination(userId)))
      await this.repo.setDestination(userId, credentialId, primary.id, primary.id);
  }

  async listConnections(userId: number): Promise<ConnectedCalendarDto[]> {
    const [credentials, selected, destination] = await Promise.all([
      this.repo.findGoogleCredentialsByUserId(userId),
      this.repo.findSelectedCalendars(userId),
      this.repo.findDestination(userId),
    ]);
    return Promise.all(
      credentials.map(async (row) => {
        try {
          const calendars = await (await this.clientFor(row)).listCalendars();
          return {
            credentialId: row.id,
            error: false,
            calendars: calendars.map((calendar) => ({
              id: calendar.id,
              name: calendar.summary,
              primary: Boolean(calendar.primary),
              selected: selected.some((s) => s.credentialId === row.id && s.externalId === calendar.id),
              destination: destination?.credentialId === row.id && destination.externalId === calendar.id,
            })),
          };
        } catch (error) {
          console.error(`Listing Google calendars for credential ${row.id} failed`, error);
          return { credentialId: row.id, error: true, calendars: [] };
        }
      })
    );
  }

  async setSelected(
    userId: number,
    credentialId: number,
    calendarId: string,
    selected: boolean
  ): Promise<void> {
    await this.findOwnedCredential(userId, credentialId);
    await this.repo.setSelected(userId, credentialId, calendarId, selected);
  }

  async setDestination(userId: number, credentialId: number, calendarId: string): Promise<void> {
    await this.findOwnedCredential(userId, credentialId);
    await this.repo.setDestination(userId, credentialId, calendarId, calendarId);
  }

  async disconnect(userId: number, credentialId: number): Promise<void> {
    const row = await this.findOwnedCredential(userId, credentialId);
    try {
      const tokens = await this.open(row);
      const token = tokens.refresh_token ?? tokens.access_token;
      await (this.config.fetchImpl ?? fetch)(
        `${this.config.oauth.endpoints.revoke}?token=${encodeURIComponent(token)}`,
        { method: "POST" }
      );
    } catch (error) {
      // Revocation is a courtesy to Google; the credential is removed either way.
      console.error("Revoking Google token failed", error);
    }
    await this.repo.deleteCredential(credentialId);
  }

  /** Busy time from the user's selected Google calendars; a broken connection never blocks booking. */
  async busyTimes(userId: number, from: Date, to: Date): Promise<BusyInterval[]> {
    const [credentials, selected] = await Promise.all([
      this.repo.findGoogleCredentialsByUserId(userId),
      this.repo.findSelectedCalendars(userId),
    ]);
    const results = await Promise.all(
      credentials.map(async (row) => {
        const ids = selected.filter((s) => s.credentialId === row.id).map((s) => s.externalId);
        if (!ids.length) return [];
        try {
          return await (await this.clientFor(row)).freeBusy(ids, from, to);
        } catch (error) {
          console.error(`Google free/busy for credential ${row.id} failed`, error);
          return [];
        }
      })
    );
    return results.flat();
  }

  async onBookingEvent(event: BookingEvent): Promise<void> {
    switch (event.type) {
      case "BOOKING_CREATED":
        await this.createEvent(event.booking);
        return;
      case "BOOKING_RESCHEDULED":
        if (event.rescheduledFrom) await this.deleteEvents(event.rescheduledFrom.uid);
        await this.createEvent(event.booking);
        return;
      case "BOOKING_CANCELLED":
      case "BOOKING_REJECTED":
        await this.deleteEvents(event.booking.uid);
        return;
      default:
        // BOOKING_REQUESTED: Cal only adds the event once the host confirms.
        return;
    }
  }

  private async createEvent(booking: BookingSnapshot): Promise<void> {
    const target = await this.resolveDestination(booking.organizer.id);
    if (!target) return;
    const wantsMeet = booking.location === GOOGLE_MEET;
    const created = await target.client.createEvent(target.calendarId, {
      summary: booking.title,
      description: this.description(booking),
      start: booking.startTime,
      end: booking.endTime,
      timeZone: booking.organizer.timeZone,
      location: wantsMeet ? null : booking.location,
      attendees: booking.attendees.map((attendee) => ({ email: attendee.email, displayName: attendee.name })),
      meetRequestId: wantsMeet ? booking.uid : undefined,
    });
    await this.repo.addReference({
      bookingUid: booking.uid,
      credentialId: target.credentialId,
      eventId: created.id,
      calendarId: target.calendarId,
      meetingUrl: created.meetUrl,
    });
    if (wantsMeet && created.meetUrl) {
      await this.repo.setBookingVideoUrl(booking.uid, created.meetUrl);
      // Listeners run in order; later ones (webhooks, emails) should see the real link.
      booking.location = created.meetUrl;
    }
  }

  private async deleteEvents(bookingUid: string): Promise<void> {
    for (const reference of await this.repo.findReferencesByBookingUid(bookingUid)) {
      if (!reference.credentialId || !reference.externalCalendarId) continue;
      const row = await this.repo.findCredentialById(reference.credentialId);
      if (!row) continue;
      await (await this.clientFor(row)).deleteEvent(reference.externalCalendarId, reference.uid);
      await this.repo.markReferenceDeleted(reference.id);
    }
  }

  private async resolveDestination(userId: number) {
    const credentials = await this.repo.findGoogleCredentialsByUserId(userId);
    if (!credentials.length) return null;
    const destination = await this.repo.findDestination(userId);
    const row = credentials.find((c) => c.id === destination?.credentialId) ?? credentials[0];
    const calendarId = destination?.credentialId === row.id ? destination.externalId : "primary";
    return { client: await this.clientFor(row), calendarId, credentialId: row.id };
  }

  private description(booking: BookingSnapshot): string {
    const notes = typeof booking.responses.notes === "string" ? `\n\n${booking.responses.notes}` : "";
    return `${booking.eventType?.title ?? booking.title}${notes}\n\n${this.config.publicUrl}/booking/${booking.uid}`;
  }

  private async findOwnedCredential(userId: number, credentialId: number): Promise<CredentialRow> {
    const row = await this.repo.findCredentialById(credentialId);
    if (!row || row.userId !== userId) throw new AppError("not_found", 404);
    return row;
  }

  private async clientFor(row: CredentialRow): Promise<GoogleCalendarClient> {
    return new GoogleCalendarClient(
      await this.open(row),
      this.config.oauth,
      async (tokens) => this.repo.updateCredentialKey(row.id, await this.seal(tokens)),
      this.config.fetchImpl
    );
  }

  private seal(tokens: GoogleTokens): Promise<string> {
    return symmetricEncrypt(JSON.stringify(tokens), this.config.encryptionKey);
  }

  private async open(row: CredentialRow): Promise<GoogleTokens> {
    // Credentials migrated from Cal may still be plaintext in `key`.
    if (row.encryptedKey)
      return JSON.parse(await symmetricDecrypt(row.encryptedKey, this.config.encryptionKey));
    return row.key as GoogleTokens;
  }
}
