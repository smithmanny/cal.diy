import "@tanstack/react-start/server-only";

type EventsResponse = {
  items?: { id: string; summary: string; start: { date?: string; dateTime?: string } }[];
  error?: { message: string };
};

export type FetchedHoliday = { eventId: string; name: string; date: Date };

/**
 * Reads one year of a Google public holiday calendar with an API key (Cal's GOOGLE_CALENDAR_API_KEY);
 * no user OAuth is involved. Dates are all-day, stored as UTC midnight like Cal does.
 */
export function createGoogleHolidayFetcher(options: {
  apiBase: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (calendarId: string, year: number): Promise<FetchedHoliday[]> => {
    const url = new URL(`${options.apiBase}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("key", options.apiKey);
    url.searchParams.set("timeMin", `${year}-01-01T00:00:00Z`);
    url.searchParams.set("timeMax", `${year}-12-31T23:59:59Z`);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    const response = await fetchImpl(url);
    const data = (await response.json()) as EventsResponse;
    if (!response.ok || data.error) {
      throw new Error(
        `Google holiday calendar ${calendarId} failed: ${data.error?.message ?? response.status}`
      );
    }
    return (data.items ?? []).flatMap((event) => {
      const day = event.start.date ?? event.start.dateTime?.slice(0, 10);
      return day ? [{ eventId: event.id, name: event.summary, date: new Date(`${day}T00:00:00Z`) }] : [];
    });
  };
}
