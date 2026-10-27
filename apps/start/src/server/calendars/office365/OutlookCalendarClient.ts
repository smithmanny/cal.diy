import type { BusyInterval } from "@calcom/scheduling/available-slots";
import { exchangeOAuthCode, type OAuthClientConfig, OAuthSession, type OAuthTokens } from "../../apps/oauth";
import type {
  CalendarClient,
  CalendarEventInput,
  CalendarListEntry,
  CalendarProvider,
  CreatedCalendarEvent,
} from "../types";

type GraphCalendar = { id: string; name: string; isDefaultCalendar?: boolean };
type GraphEvent = { showAs?: string; start: { dateTime: string }; end: { dateTime: string } };
type GraphPage<T> = { value?: T[]; "@odata.nextLink"?: string };

// With `Prefer: outlook.timezone="UTC"`, Graph returns UTC times without an offset.
const utc = (dateTime: string) => new Date(dateTime.endsWith("Z") ? dateTime : `${dateTime}Z`);
const graphDateTime = (date: Date) => ({ dateTime: date.toISOString().slice(0, 19), timeZone: "UTC" });

export const OFFICE365_CALENDAR_TYPE = "office365_calendar";

export const OFFICE365_CALENDAR_SCOPES = [
  "User.Read",
  "Calendars.Read",
  "Calendars.ReadWrite",
  "offline_access",
];

/** Outlook / Microsoft 365 calendars over Microsoft Graph. */
export class OutlookCalendarClient implements CalendarClient {
  constructor(
    private readonly session: OAuthSession,
    private readonly graphUrl: string
  ) {}

  async listCalendars(): Promise<CalendarListEntry[]> {
    const calendars = await this.pages<GraphCalendar>(
      `${this.graphUrl}/me/calendars?$select=id,name,isDefaultCalendar`
    );
    return calendars.map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      primary: Boolean(calendar.isDefaultCalendar),
    }));
  }

  async busyTimes(calendarIds: string[], from: Date, to: Date): Promise<BusyInterval[]> {
    const range = new URLSearchParams({
      startDateTime: from.toISOString(),
      endDateTime: to.toISOString(),
      $select: "showAs,start,end",
      $top: "500",
    });
    const perCalendar = await Promise.all(
      calendarIds.map((id) =>
        this.pages<GraphEvent>(
          `${this.graphUrl}/me/calendars/${encodeURIComponent(id)}/calendarView?${range}`
        )
      )
    );
    return perCalendar
      .flat()
      .filter((event) => event.showAs !== "free" && event.showAs !== "workingElsewhere")
      .map((event) => ({ start: utc(event.start.dateTime), end: utc(event.end.dateTime) }));
  }

  async createEvent(calendarId: string, event: CalendarEventInput): Promise<CreatedCalendarEvent> {
    const created = await this.session.request<{ id: string }>(
      `${this.graphUrl}/me/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        body: {
          subject: event.summary,
          body: { contentType: "text", content: event.description },
          start: graphDateTime(event.start),
          end: graphDateTime(event.end),
          location: event.location ? { displayName: event.location } : undefined,
          attendees: event.attendees.map((attendee) => ({
            emailAddress: { address: attendee.email, name: attendee.displayName ?? attendee.email },
            type: "required",
          })),
          sensitivity: event.private ? "private" : "normal",
        },
      }
    );
    return { id: created.id, meetUrl: null };
  }

  async deleteEvent(_calendarId: string, eventId: string): Promise<void> {
    await this.session.request(
      `${this.graphUrl}/me/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
      [404, 410]
    );
  }

  private async pages<T>(firstUrl: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | undefined = firstUrl;
    // A safety cap: a month of busy times fits in a page or two.
    for (let page = 0; url && page < 20; page++) {
      const json: GraphPage<T> = await this.session.request<GraphPage<T>>(url, {
        method: "GET",
        headers: { Prefer: 'outlook.timezone="UTC"' },
      });
      items.push(...(json.value ?? []));
      url = json["@odata.nextLink"];
    }
    return items;
  }
}

export function outlookCalendarProvider(
  oauth: OAuthClientConfig,
  graphUrl: string,
  fetchImpl: typeof fetch = fetch
): CalendarProvider {
  return {
    type: OFFICE365_CALENDAR_TYPE,
    open: (key, onKeyChange) =>
      new OutlookCalendarClient(
        new OAuthSession(key as OAuthTokens, oauth, onKeyChange, fetchImpl),
        graphUrl
      ),
    exchangeCode: (code) => exchangeOAuthCode(oauth, code, fetchImpl),
  };
}
