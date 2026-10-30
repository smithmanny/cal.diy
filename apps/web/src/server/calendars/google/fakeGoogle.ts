// A tiny in-memory Google (OAuth token endpoint + Calendar API) for tests.
export type FakeGoogle = {
  fetch: typeof fetch;
  calls: { method: string; url: string; body: unknown }[];
  events: Map<string, { calendarId: string; body: Record<string, unknown> }>;
  busy: { start: string; end: string }[];
  tokenRequests: number;
};

export const FAKE_ENDPOINTS = {
  authorize: "https://google.test/auth",
  token: "https://google.test/token",
  revoke: "https://google.test/revoke",
  calendarApi: "https://google.test/calendar/v3",
};

export function createFakeGoogle({ expiresIn = 3600 }: { expiresIn?: number } = {}): FakeGoogle {
  const state: FakeGoogle = {
    fetch: undefined as unknown as typeof fetch,
    calls: [],
    events: new Map(),
    busy: [],
    tokenRequests: 0,
  };
  let counter = 0;
  state.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const rawBody = init?.body;
    const body =
      typeof rawBody === "string"
        ? rawBody.startsWith("{")
          ? JSON.parse(rawBody)
          : rawBody
        : rawBody?.toString();
    state.calls.push({ method, url: url.href, body });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

    if (url.href.startsWith(FAKE_ENDPOINTS.token)) {
      state.tokenRequests++;
      return json({
        access_token: `access-${state.tokenRequests}`,
        refresh_token: state.tokenRequests === 1 ? "refresh-1" : undefined,
        expires_in: expiresIn,
        scope: "calendar",
        token_type: "Bearer",
      });
    }
    if (url.href.startsWith(FAKE_ENDPOINTS.revoke)) return new Response("", { status: 200 });
    const path = url.pathname.replace("/calendar/v3", "");
    if (path === "/users/me/calendarList") {
      return json({
        items: [
          { id: "me@example.com", summary: "Me", primary: true, accessRole: "owner" },
          { id: "team@group", summary: "Team", accessRole: "reader" },
        ],
      });
    }
    if (path === "/freeBusy") {
      const ids = (body as { items: { id: string }[] }).items.map((item) => item.id);
      return json({ calendars: Object.fromEntries(ids.map((id) => [id, { busy: state.busy }])) });
    }
    const eventMatch = path.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (eventMatch && method === "POST") {
      const id = `evt-${++counter}`;
      state.events.set(id, {
        calendarId: decodeURIComponent(eventMatch[1]),
        body: body as Record<string, unknown>,
      });
      const meet = (body as { conferenceData?: unknown }).conferenceData
        ? { hangoutLink: `https://meet.google.com/${id}` }
        : {};
      return json({ id, iCalUID: `${id}@google.com`, ...meet });
    }
    if (eventMatch && method === "DELETE") {
      const id = decodeURIComponent(eventMatch[2] ?? "");
      if (!state.events.delete(id)) return new Response("", { status: 410 });
      return new Response(null, { status: 204 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return state;
}
