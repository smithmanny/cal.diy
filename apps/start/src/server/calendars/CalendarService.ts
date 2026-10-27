import "@tanstack/react-start/server-only";

import type { BusyInterval } from "@calcom/scheduling/available-slots";
import type { CredentialRepository, CredentialRow } from "../apps/CredentialRepository";
import type { CredentialVault } from "../apps/CredentialVault";
import type { BookingEvent, BookingSnapshot } from "../bookings/events";
import { AppError } from "../errors";
import type { CalendarRepository } from "./CalendarRepository";
import { GOOGLE_CALENDAR_TYPE } from "./google/provider";
import type { CalendarClient, CalendarProvider } from "./types";

const GOOGLE_MEET = "integrations:google:meet";

export type CalendarServiceConfig = {
  providers: CalendarProvider[];
  vault: CredentialVault;
  /** Public origin, for the manage-booking link in event descriptions. */
  publicUrl: string;
};

export type ConnectedCalendarDto = {
  credentialId: number;
  type: string;
  error: boolean;
  calendars: { id: string; name: string; primary: boolean; selected: boolean; destination: boolean }[];
};

export class CalendarService {
  private readonly providers: Map<string, CalendarProvider>;

  constructor(
    private readonly repo: CalendarRepository,
    private readonly credentials: CredentialRepository,
    private readonly config: CalendarServiceConfig
  ) {
    this.providers = new Map(config.providers.map((provider) => [provider.type, provider]));
  }

  hasProvider(type: string): boolean {
    return this.providers.has(type);
  }

  async connectOAuth(userId: number, type: string, code: string): Promise<void> {
    const exchange = this.providers.get(type)?.exchangeCode;
    if (!exchange) throw new AppError("not_found", 404);
    await this.connect(userId, type, await exchange(code));
  }

  /**
   * Stores a calendar credential once it has proven it works, then, like Cal, checks the primary
   * calendar for conflicts and writes new events there unless a destination is already set.
   */
  async connect(userId: number, type: string, key: unknown): Promise<number> {
    const provider = this.providers.get(type);
    if (!provider) throw new AppError("not_found", 404);
    let calendars: Awaited<ReturnType<CalendarClient["listCalendars"]>>;
    try {
      calendars = await provider.open(key, async () => {}).listCalendars();
    } catch (error) {
      console.error(`Connecting a ${type} credential failed`, error);
      throw new AppError("calendar_connection_fail", 400);
    }
    const credentialId = await this.credentials.create(userId, type, await this.config.vault.seal(key));
    const primary = calendars.find((calendar) => calendar.primary) ?? calendars[0];
    if (!primary) return credentialId;
    const credential = { id: credentialId, type };
    await this.repo.setSelected(userId, credential, primary.id, true);
    if (!(await this.repo.findDestination(userId)))
      await this.repo.setDestination(userId, credential, primary.id, primary.id);
    return credentialId;
  }

  async listConnections(userId: number): Promise<ConnectedCalendarDto[]> {
    const [rows, selected, destination] = await Promise.all([
      this.calendarCredentials(userId),
      this.repo.findSelectedCalendars(userId),
      this.repo.findDestination(userId),
    ]);
    return Promise.all(
      rows.map(async (row) => {
        try {
          const calendars = await (await this.clientFor(row)).listCalendars();
          return {
            credentialId: row.id,
            type: row.type,
            error: false,
            calendars: calendars.map((calendar) => ({
              ...calendar,
              selected: selected.some((s) => s.credentialId === row.id && s.externalId === calendar.id),
              destination: destination?.credentialId === row.id && destination.externalId === calendar.id,
            })),
          };
        } catch (error) {
          console.error(`Listing calendars for credential ${row.id} failed`, error);
          return { credentialId: row.id, type: row.type, error: true, calendars: [] };
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
    const row = await this.findOwnedCredential(userId, credentialId);
    await this.repo.setSelected(userId, row, calendarId, selected);
  }

  async setDestination(userId: number, credentialId: number, calendarId: string): Promise<void> {
    const row = await this.findOwnedCredential(userId, credentialId);
    await this.repo.setDestination(userId, row, calendarId, calendarId);
  }

  async disconnect(userId: number, credentialId: number): Promise<void> {
    const row = await this.findOwnedCredential(userId, credentialId);
    const revoke = this.providers.get(row.type)?.revoke;
    try {
      if (revoke) await revoke(await this.config.vault.open(row));
    } catch (error) {
      // Revocation is a courtesy to the provider; the credential is removed either way.
      console.error(`Revoking ${row.type} access failed`, error);
    }
    await this.credentials.delete(credentialId);
  }

  /** Busy time from the user's selected calendars; a broken connection never blocks booking. */
  async busyTimes(userId: number, from: Date, to: Date): Promise<BusyInterval[]> {
    const [rows, selected] = await Promise.all([
      this.calendarCredentials(userId),
      this.repo.findSelectedCalendars(userId),
    ]);
    const results = await Promise.all(
      rows.map(async (row) => {
        const ids = selected.filter((s) => s.credentialId === row.id).map((s) => s.externalId);
        if (!ids.length) return [];
        try {
          return await (await this.clientFor(row)).busyTimes(ids, from, to);
        } catch (error) {
          console.error(`Busy times for credential ${row.id} failed`, error);
          return [];
        }
      })
    );
    return results.flat();
  }

  async onBookingEvent(event: BookingEvent): Promise<void> {
    // One calendar event serves every seat; a seat coming or going doesn't add or remove it.
    if (event.seat) {
      if (event.type !== "BOOKING_CANCELLED" && !(await this.hasEvent(event.booking.uid)))
        await this.createEvent(event.booking);
      return;
    }
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
    const wantsMeet = booking.location === GOOGLE_MEET;
    const target = await this.resolveDestination(booking.organizer.id, wantsMeet);
    if (!target) return;
    const created = await target.client.createEvent(target.calendarId, {
      uid: booking.uid,
      summary: booking.title,
      description: this.description(booking),
      start: booking.startTime,
      end: booking.endTime,
      timeZone: booking.organizer.timeZone,
      location: wantsMeet ? null : booking.location,
      organizer: { name: booking.organizer.name, email: booking.organizer.email },
      attendees: booking.attendees.map((attendee) => ({
        email: attendee.email,
        displayName: attendee.name || undefined,
      })),
      googleMeet: wantsMeet,
      private: Boolean(booking.eventType?.hideCalendarEventDetails),
    });
    await this.repo.addReference({
      bookingUid: booking.uid,
      type: target.type,
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

  private async hasEvent(bookingUid: string): Promise<boolean> {
    return (await this.repo.findReferencesByBookingUid(bookingUid, [...this.providers.keys()])).length > 0;
  }

  private async deleteEvents(bookingUid: string): Promise<void> {
    const references = await this.repo.findReferencesByBookingUid(bookingUid, [...this.providers.keys()]);
    for (const reference of references) {
      if (!reference.credentialId || !reference.externalCalendarId) continue;
      const row = await this.credentials.findById(reference.credentialId);
      if (!row) continue;
      await (await this.clientFor(row)).deleteEvent(reference.externalCalendarId, reference.uid);
      await this.repo.markReferenceDeleted(reference.id);
    }
  }

  /**
   * The destination calendar, else the primary calendar of the first connection. Only Google can
   * add a Meet link, so a Meet booking goes to a Google calendar when there is one.
   */
  private async resolveDestination(userId: number, needsGoogle: boolean) {
    const rows = await this.calendarCredentials(userId);
    const destination = await this.repo.findDestination(userId);
    const candidates = needsGoogle ? rows.filter((row) => row.type === GOOGLE_CALENDAR_TYPE) : rows;
    const row = candidates.find((c) => c.id === destination?.credentialId) ?? candidates[0] ?? rows[0];
    if (!row) return null;
    const client = await this.clientFor(row);
    let calendarId = destination?.credentialId === row.id ? destination.externalId : null;
    if (!calendarId) {
      const calendars = await client.listCalendars();
      calendarId = (calendars.find((calendar) => calendar.primary) ?? calendars[0])?.id ?? null;
    }
    if (!calendarId) return null;
    return { client, calendarId, credentialId: row.id, type: row.type };
  }

  private description(booking: BookingSnapshot): string {
    const notes =
      typeof booking.responses.notes === "string" && !booking.eventType?.hideCalendarNotes
        ? `\n\n${booking.responses.notes}`
        : "";
    return `${booking.eventType?.title ?? booking.title}${notes}\n\n${this.config.publicUrl}/booking/${booking.uid}`;
  }

  private calendarCredentials(userId: number): Promise<CredentialRow[]> {
    return this.credentials.findByUserId(userId, [...this.providers.keys()]);
  }

  private async findOwnedCredential(userId: number, credentialId: number): Promise<CredentialRow> {
    const row = await this.credentials.findById(credentialId);
    if (!row || row.userId !== userId || !this.providers.has(row.type)) throw new AppError("not_found", 404);
    return row;
  }

  private async clientFor(row: CredentialRow): Promise<CalendarClient> {
    const provider = this.providers.get(row.type);
    if (!provider) throw new Error(`No calendar provider for ${row.type}`);
    return provider.open(await this.config.vault.open(row), async (key) =>
      this.credentials.updateKey(row.id, await this.config.vault.seal(key))
    );
  }
}
