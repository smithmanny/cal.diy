import type { BusyInterval } from "@calcom/scheduling/available-slots";
import type {
  CalendarClient,
  CalendarEventInput,
  CalendarListEntry,
  CalendarProvider,
  CreatedCalendarEvent,
} from "../types";
import { buildCalendarObject, busyFromIcs } from "./ical";
import { decodeXmlText, element, hrefProp, parseMultistatus } from "./xml";

const DAV_NAMESPACES = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"';

function basicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

function icsStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function propfind(props: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><d:propfind ${DAV_NAMESPACES}><d:prop>${props}</d:prop></d:propfind>`;
}

function isEventCalendar(props: string): boolean {
  const resourceType = element(props, "resourcetype") ?? "";
  if (!/<calendar[\s/>]/.test(resourceType)) return false;
  const components = element(props, "supported-calendar-component-set");
  return components === null || /name="VEVENT"/i.test(components);
}

export const CALDAV_CALENDAR_TYPE = "caldav_calendar";
export const APPLE_CALENDAR_TYPE = "apple_calendar";

/** Cal's key for CalDAV (and Apple, whose url is fixed). */
export type CalDavKey = { url: string; username: string; password: string };

/** A calendar server over plain CalDAV (RFC 4791): discovery, busy times via REPORT, events via PUT. */
export class CalDavClient implements CalendarClient {
  constructor(
    private readonly key: CalDavKey,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  /** current-user-principal → calendar-home-set → the calendars in it that hold events. */
  async listCalendars(): Promise<CalendarListEntry[]> {
    const principal =
      (await this.findHref(this.key.url, "<d:current-user-principal/>", "current-user-principal")) ??
      this.key.url;
    const home = (await this.findHref(principal, "<c:calendar-home-set/>", "calendar-home-set")) ?? principal;
    const xml = await this.dav(
      "PROPFIND",
      home,
      propfind("<d:resourcetype/><d:displayname/><c:supported-calendar-component-set/>"),
      "1"
    );
    const calendars = parseMultistatus(xml).filter((response) => isEventCalendar(response.props));
    return calendars.map((calendar, index) => {
      const id = new URL(calendar.href, home).href;
      const name = decodeXmlText(element(calendar.props, "displayname")?.trim() ?? "");
      // CalDAV has no primary calendar; the first one stands in for it.
      return {
        id,
        name: name || decodeURIComponent(id.split("/").filter(Boolean).pop() ?? id),
        primary: index === 0,
      };
    });
  }

  async busyTimes(calendarIds: string[], from: Date, to: Date): Promise<BusyInterval[]> {
    const range = `start="${icsStamp(from)}" end="${icsStamp(to)}"`;
    // <c:expand> asks the server to return each occurrence of a recurring event in UTC.
    const query = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query ${DAV_NAMESPACES}><d:prop><c:calendar-data><c:expand ${range}/></c:calendar-data></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range ${range}/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
    const perCalendar = await Promise.all(
      calendarIds.map(async (calendarId) => {
        const xml = await this.dav("REPORT", calendarId, query, "1");
        return parseMultistatus(xml).flatMap((response) =>
          busyFromIcs(decodeXmlText(element(response.props, "calendar-data") ?? ""))
        );
      })
    );
    return perCalendar.flat().filter((busy) => busy.end > from && busy.start < to);
  }

  async createEvent(calendarId: string, event: CalendarEventInput): Promise<CreatedCalendarEvent> {
    const response = await this.fetchImpl(this.eventUrl(calendarId, event.uid), {
      method: "PUT",
      headers: {
        Authorization: basicAuth(this.key.username, this.key.password),
        "Content-Type": "text/calendar; charset=utf-8",
        "If-None-Match": "*",
      },
      body: buildCalendarObject(event),
    });
    if (!response.ok) throw new Error(`CalDAV PUT failed with ${response.status}`);
    return { id: event.uid, meetUrl: null };
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const response = await this.fetchImpl(this.eventUrl(calendarId, eventId), {
      method: "DELETE",
      headers: { Authorization: basicAuth(this.key.username, this.key.password) },
    });
    if (!response.ok && response.status !== 404 && response.status !== 410)
      throw new Error(`CalDAV DELETE failed with ${response.status}`);
  }

  private eventUrl(calendarId: string, uid: string): string {
    return new URL(`${encodeURIComponent(uid)}.ics`, calendarId.endsWith("/") ? calendarId : `${calendarId}/`)
      .href;
  }

  private async findHref(url: string, prop: string, name: string): Promise<string | null> {
    const xml = await this.dav("PROPFIND", url, propfind(prop), "0");
    for (const response of parseMultistatus(xml)) {
      const href = hrefProp(response.props, name);
      if (href) return new URL(href, url).href;
    }
    return null;
  }

  private async dav(method: string, url: string, body: string, depth: "0" | "1"): Promise<string> {
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: basicAuth(this.key.username, this.key.password),
        "Content-Type": "application/xml; charset=utf-8",
        Depth: depth,
      },
      body,
    });
    if (response.status !== 207 && !response.ok)
      throw new Error(`CalDAV ${method} ${new URL(url).pathname} failed with ${response.status}`);
    return response.text();
  }
}

export function calDavProvider(fetchImpl: typeof fetch = fetch): CalendarProvider {
  return {
    type: CALDAV_CALENDAR_TYPE,
    open: (key) => new CalDavClient(key as CalDavKey, fetchImpl),
  };
}

/** iCloud is CalDAV at a fixed address, signed in with an app-specific password. */
export function appleCalendarProvider(appleUrl: string, fetchImpl: typeof fetch = fetch): CalendarProvider {
  return {
    type: APPLE_CALENDAR_TYPE,
    open: (key) => new CalDavClient({ ...(key as Omit<CalDavKey, "url">), url: appleUrl }, fetchImpl),
  };
}
