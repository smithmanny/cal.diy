import type { BusyInterval } from "@calcom/scheduling/available-slots";
import type { CalendarClient, CalendarEventInput, CalendarListEntry, CreatedCalendarEvent } from "../types";
import type { GoogleOAuthConfig, GoogleTokens } from "./oauth";
import { refreshTokens } from "./oauth";

type GoogleCalendarListEntry = { id: string; summary: string; primary?: boolean; accessRole: string };

/**
 * A minimal fetch-based Google Calendar client (googleapis needs Node APIs Workers don't have).
 * Refreshes the access token when it's about to expire and reports new tokens via `onTokens`
 * so they can be persisted.
 */
export class GoogleCalendarClient implements CalendarClient {
  constructor(
    private tokens: GoogleTokens,
    private readonly config: GoogleOAuthConfig,
    private readonly onTokens: (tokens: GoogleTokens) => Promise<void>,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async listCalendars(): Promise<CalendarListEntry[]> {
    const json = await this.request<{ items?: GoogleCalendarListEntry[] }>(
      "GET",
      "/users/me/calendarList?minAccessRole=reader"
    );
    return (json.items ?? []).map((calendar) => ({
      id: calendar.id,
      name: calendar.summary,
      primary: Boolean(calendar.primary),
    }));
  }

  async busyTimes(calendarIds: string[], from: Date, to: Date): Promise<BusyInterval[]> {
    if (!calendarIds.length) return [];
    const json = await this.request<{
      calendars: Record<string, { busy?: { start: string; end: string }[] }>;
    }>("POST", "/freeBusy", {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: calendarIds.map((id) => ({ id })),
    });
    return Object.values(json.calendars ?? {}).flatMap((calendar) =>
      (calendar.busy ?? []).map((busy) => ({ start: new Date(busy.start), end: new Date(busy.end) }))
    );
  }

  async createEvent(calendarId: string, event: CalendarEventInput): Promise<CreatedCalendarEvent> {
    const body = {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString(), timeZone: event.timeZone },
      end: { dateTime: event.end.toISOString(), timeZone: event.timeZone },
      location: event.location ?? undefined,
      attendees: event.attendees,
      reminders: { useDefault: true },
      ...(event.private && { visibility: "private" }),
      // The booking uid as requestId makes the Meet request idempotent.
      ...(event.googleMeet && {
        conferenceData: {
          createRequest: { requestId: event.uid, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    };
    // Cal sends its own emails, so Google shouldn't email attendees too.
    const path = `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`;
    const created = await this.request<{
      id: string;
      hangoutLink?: string;
      conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
    }>("POST", path, body);
    const meetUrl =
      created.hangoutLink ??
      created.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
      null;
    return { id: created.id, meetUrl };
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.request(
      "DELETE",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      undefined,
      [404, 410]
    );
  }

  private async accessToken(): Promise<string> {
    if (this.tokens.expiry_date - Date.now() < 60_000) {
      this.tokens = await refreshTokens(this.config, this.tokens, this.fetchImpl);
      await this.onTokens(this.tokens);
    }
    return this.tokens.access_token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    ignoredStatuses: number[] = []
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.config.endpoints.calendarApi}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (ignoredStatuses.includes(response.status)) return {} as T;
    if (!response.ok)
      throw new Error(`Google Calendar ${method} ${path.split("?")[0]} failed with ${response.status}`);
    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  }
}
