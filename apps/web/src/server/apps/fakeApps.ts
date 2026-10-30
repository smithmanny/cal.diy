// In-memory Microsoft (OAuth + Graph), Zoom and Daily for tests, on one origin with path prefixes
// (see FAKE_APP_PATHS). Served through `fetch` in unit tests and over HTTP in e2e.

type FakeAppsState = {
  calls: { method: string; path: string; body: unknown; authorization: string | null }[];
  tokenRequests: { path: string; params: Record<string, string>; authorization: string | null }[];
  /** Outlook events per calendar; `showAs` free ones don't block. */
  outlookEvents: {
    id: string;
    calendarId: string;
    showAs: string;
    start: string;
    end: string;
    body?: unknown;
  }[];
  meetings: Map<string, { app: "zoom" | "teams" | "daily"; body: unknown }>;
  /** Seconds the issued access tokens last. */
  expiresIn: number;
};

type FakeRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  body: string;
  authorization: string | null;
};

type FakeResponse = { status: number; body?: unknown; location?: string };

let counter = 0;

function json(body: unknown, status = 200): FakeResponse {
  return { status, body };
}

function token(state: FakeAppsState, request: FakeRequest): FakeResponse {
  const params = Object.fromEntries(new URLSearchParams(request.body));
  state.tokenRequests.push({ path: request.path, params, authorization: request.authorization });
  return json({
    access_token: `at-${++counter}`,
    refresh_token: `rt-${counter}`,
    expires_in: state.expiresIn,
    token_type: "Bearer",
    scope: params.scope ?? "",
  });
}

/** The consent screen approves at once and returns to the app with a code. */
function authorize(request: FakeRequest): FakeResponse {
  const back = new URL(request.query.get("redirect_uri") ?? "");
  back.searchParams.set("code", "fake-code");
  back.searchParams.set("state", request.query.get("state") ?? "");
  return { status: 302, location: back.href };
}

function graph(state: FakeAppsState, request: FakeRequest, path: string): FakeResponse {
  if (request.method === "GET" && path === "/me/calendars")
    return json({
      value: [
        { id: "cal-main", name: "Calendar", isDefaultCalendar: true },
        { id: "cal-team", name: "Team", isDefaultCalendar: false },
      ],
    });
  const view = path.match(/^\/me\/calendars\/([^/]+)\/calendarView$/);
  if (view) {
    const events = state.outlookEvents.filter((event) => event.calendarId === decodeURIComponent(view[1]));
    // Two pages, to exercise @odata.nextLink.
    if (!request.query.get("page"))
      return json({
        value: events
          .slice(0, 1)
          .map(({ showAs, start, end }) => ({ showAs, start: { dateTime: start }, end: { dateTime: end } })),
        "@odata.nextLink": `${request.query.get("origin") ?? ""}${FAKE_APP_PATHS.microsoftGraph}${path}?page=2`,
      });
    return json({
      value: events
        .slice(1)
        .map(({ showAs, start, end }) => ({ showAs, start: { dateTime: start }, end: { dateTime: end } })),
    });
  }
  const create = path.match(/^\/me\/calendars\/([^/]+)\/events$/);
  if (create && request.method === "POST") {
    const body = JSON.parse(request.body);
    const id = `ms-evt-${++counter}`;
    state.outlookEvents.push({
      id,
      calendarId: decodeURIComponent(create[1]),
      showAs: "busy",
      start: body.start.dateTime,
      end: body.end.dateTime,
      body,
    });
    return json({ id }, 201);
  }
  const remove = path.match(/^\/me\/events\/([^/]+)$/);
  if (remove && request.method === "DELETE") {
    const before = state.outlookEvents.length;
    state.outlookEvents = state.outlookEvents.filter((event) => event.id !== decodeURIComponent(remove[1]));
    return { status: before === state.outlookEvents.length ? 404 : 204 };
  }
  if (path === "/me/onlineMeetings" && request.method === "POST") {
    const id = `teams-${++counter}`;
    state.meetings.set(id, { app: "teams", body: JSON.parse(request.body) });
    return json({ id, joinWebUrl: `https://teams.microsoft.com/l/meetup-join/${id}` }, 201);
  }
  const meeting = path.match(/^\/me\/onlineMeetings\/([^/]+)$/);
  if (meeting && request.method === "DELETE")
    return { status: state.meetings.delete(decodeURIComponent(meeting[1])) ? 204 : 404 };
  return json({ error: `unknown ${request.method} ${path}` }, 404);
}

function zoom(state: FakeAppsState, request: FakeRequest, path: string): FakeResponse {
  if (path === "/users/me/meetings" && request.method === "POST") {
    const id = 9_000_000 + ++counter;
    state.meetings.set(String(id), { app: "zoom", body: JSON.parse(request.body) });
    return json({ id, join_url: `https://zoom.us/j/${id}?pwd=fake`, password: "fake" }, 201);
  }
  const meeting = path.match(/^\/meetings\/([^/]+)$/);
  if (meeting && request.method === "DELETE")
    return { status: state.meetings.delete(decodeURIComponent(meeting[1])) ? 204 : 404 };
  return json({ error: `unknown ${request.method} ${path}` }, 404);
}

function daily(state: FakeAppsState, request: FakeRequest, path: string): FakeResponse {
  if (path === "/rooms" && request.method === "POST") {
    const name = `room-${++counter}`;
    state.meetings.set(name, { app: "daily", body: JSON.parse(request.body) });
    return json({ name, url: `https://cal.daily.co/${name}` });
  }
  const room = path.match(/^\/rooms\/([^/]+)$/);
  if (room && request.method === "DELETE")
    return {
      status: state.meetings.delete(decodeURIComponent(room[1])) ? 200 : 404,
      body: { deleted: true },
    };
  return json({ error: `unknown ${request.method} ${path}` }, 404);
}

export const FAKE_APP_PATHS = {
  microsoftOAuth: "/ms/oauth",
  microsoftGraph: "/ms/graph",
  zoomOAuth: "/zoom/oauth",
  zoomApi: "/zoom/api",
  dailyApi: "/daily",
};

export function createFakeAppsState(): FakeAppsState {
  return { calls: [], tokenRequests: [], outlookEvents: [], meetings: new Map(), expiresIn: 3600 };
}

export function handleFakeApps(state: FakeAppsState, request: FakeRequest): FakeResponse {
  const { path } = request;
  state.calls.push({
    method: request.method,
    path,
    body: request.body.startsWith("{") ? JSON.parse(request.body) : request.body,
    authorization: request.authorization,
  });
  const within = (prefix: string) => (path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : null);
  const oauth = within(FAKE_APP_PATHS.microsoftOAuth) ?? within(FAKE_APP_PATHS.zoomOAuth);
  if (oauth === "/authorize") return authorize(request);
  if (oauth === "/token") return token(state, request);
  const graphPath = within(FAKE_APP_PATHS.microsoftGraph);
  if (graphPath) return graph(state, request, graphPath);
  const zoomPath = within(FAKE_APP_PATHS.zoomApi);
  if (zoomPath) return zoom(state, request, zoomPath);
  const dailyPath = within(FAKE_APP_PATHS.dailyApi);
  if (dailyPath) return daily(state, request, dailyPath);
  return json({ error: `unknown ${path}` }, 404);
}

/** The fakes as a `fetch` on `origin`, for unit tests. */
export function fakeAppsFetch(state: FakeAppsState, origin = "https://apps.test"): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const query = new URLSearchParams(url.search);
    query.set("origin", origin);
    const result = handleFakeApps(state, {
      method: init?.method ?? "GET",
      path: url.pathname,
      query,
      body: typeof init?.body === "string" ? init.body : (init?.body?.toString() ?? ""),
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    if (result.location)
      return new Response(null, { status: result.status, headers: { Location: result.location } });
    const noBody = result.status === 204 || result.body === undefined;
    return new Response(noBody ? null : JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

export type { FakeAppsState, FakeRequest, FakeResponse };
