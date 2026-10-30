// A tiny in-memory CalDAV server for tests: one account with a "Work" calendar (events) and a
// "Tasks" calendar (to-dos only). Served through `fetch` for unit tests and over HTTP for e2e.

type FakeCalDavState = {
  /** Extra busy times reported by REPORT, besides events stored with PUT. */
  busy: { start: string; end: string }[];
  events: Map<string, string>;
  requests: { method: string; path: string; depth: string | null }[];
};

type FakeResponse = { status: number; body: string; contentType?: string };

const stamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function multistatus(responses: string[]): FakeResponse {
  return {
    status: 207,
    contentType: "application/xml; charset=utf-8",
    body: `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${responses.join("")}</D:multistatus>`,
  };
}

function response(href: string, props: string): string {
  return `<D:response><D:href>${href}</D:href><D:propstat><D:prop>${props}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
}

function calendarCollection(name: string, component: string): string {
  return `<D:resourcetype><D:collection/><C:calendar/></D:resourcetype><D:displayname>${name}</D:displayname><C:supported-calendar-component-set><C:comp name="${component}"/></C:supported-calendar-component-set>`;
}

function busyCalendarData(state: FakeCalDavState): string[] {
  const busy = state.busy.map(
    (interval, index) =>
      `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:busy-${index}\r\nDTSTART:${stamp(interval.start)}\r\nDTEND:${stamp(interval.end)}\r\nEND:VEVENT\r\nEND:VCALENDAR`
  );
  return [...busy, ...state.events.values()];
}

function propfind(path: string): FakeResponse {
  switch (path) {
    case "/dav/":
      return multistatus([
        response(
          path,
          "<D:current-user-principal><D:href>/dav/principals/cal/</D:href></D:current-user-principal>"
        ),
      ]);
    case "/dav/principals/cal/":
      return multistatus([
        response(path, "<C:calendar-home-set><D:href>/dav/calendars/cal/</D:href></C:calendar-home-set>"),
      ]);
    case "/dav/calendars/cal/":
      return multistatus([
        response(path, "<D:resourcetype><D:collection/></D:resourcetype>"),
        response("/dav/calendars/cal/work/", calendarCollection("Work", "VEVENT")),
        response("/dav/calendars/cal/tasks/", calendarCollection("Tasks", "VTODO")),
      ]);
    default:
      return { status: 404, body: "" };
  }
}

export const FAKE_CALDAV_USER = { username: "cal", password: "secret" };

export function createFakeCalDavState(): FakeCalDavState {
  return { busy: [], events: new Map(), requests: [] };
}

/** Handles one request; the caller adapts it to fetch or node:http. */
export function handleFakeCalDav(
  state: FakeCalDavState,
  request: { method: string; path: string; depth: string | null; authorization: string | null; body: string }
): FakeResponse {
  state.requests.push({ method: request.method, path: request.path, depth: request.depth });
  const expected = `Basic ${btoa(`${FAKE_CALDAV_USER.username}:${FAKE_CALDAV_USER.password}`)}`;
  if (request.authorization !== expected) return { status: 401, body: "" };
  if (request.method === "PROPFIND") return propfind(request.path);
  if (request.method === "REPORT" && request.path === "/dav/calendars/cal/work/")
    return multistatus(
      busyCalendarData(state).map((ics, index) =>
        response(
          `/dav/calendars/cal/work/${index}.ics`,
          `<C:calendar-data>${ics.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</C:calendar-data>`
        )
      )
    );
  const event = request.path.match(/^\/dav\/calendars\/cal\/work\/([^/]+)\.ics$/);
  if (event && request.method === "PUT") {
    state.events.set(decodeURIComponent(event[1]), request.body);
    return { status: 201, body: "" };
  }
  if (event && request.method === "DELETE")
    return { status: state.events.delete(decodeURIComponent(event[1])) ? 204 : 404, body: "" };
  return { status: 405, body: "" };
}

/** The fake as a `fetch`, for unit tests. */
export function fakeCalDavFetch(state: FakeCalDavState): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const headers = new Headers(init?.headers);
    const result = handleFakeCalDav(state, {
      method: init?.method ?? "GET",
      path: url.pathname,
      depth: headers.get("Depth"),
      authorization: headers.get("Authorization"),
      body: typeof init?.body === "string" ? init.body : "",
    });
    return new Response(result.status === 204 ? null : result.body, {
      status: result.status,
      headers: result.contentType ? { "Content-Type": result.contentType } : {},
    });
  }) as typeof fetch;
}

export type { FakeCalDavState };
