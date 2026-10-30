import { beforeEach, describe, expect, it } from "vitest";
import { createFakeAppsState, FAKE_APP_PATHS, type FakeAppsState, fakeAppsFetch } from "../../apps/fakeApps";
import type { OAuthClientConfig, OAuthTokens } from "../../apps/oauth";
import { OFFICE365_CALENDAR_SCOPES, outlookCalendarProvider } from "./OutlookCalendarClient";

const ORIGIN = "https://apps.test";
const oauth: OAuthClientConfig = {
  clientId: "ms-client",
  clientSecret: "ms-secret",
  redirectUri: "https://cal.test/api/integrations/office365calendar/callback",
  authorizeUrl: `${ORIGIN}${FAKE_APP_PATHS.microsoftOAuth}/authorize`,
  tokenUrl: `${ORIGIN}${FAKE_APP_PATHS.microsoftOAuth}/token`,
  scopes: OFFICE365_CALENDAR_SCOPES,
  clientAuth: "body",
  expiryUnit: "s",
};
let state: FakeAppsState;

function provider() {
  return outlookCalendarProvider(
    oauth,
    `${ORIGIN}${FAKE_APP_PATHS.microsoftGraph}`,
    fakeAppsFetch(state, ORIGIN)
  );
}

beforeEach(() => {
  state = createFakeAppsState();
});

describe("Outlook Calendar", () => {
  it("exchanges the code with the client in the body, keeping Cal's expiry in seconds", async () => {
    const tokens = (await provider().exchangeCode?.("fake-code")) as OAuthTokens;
    expect(state.tokenRequests[0].params).toMatchObject({
      grant_type: "authorization_code",
      code: "fake-code",
      client_id: "ms-client",
      client_secret: "ms-secret",
    });
    expect(tokens.expiry_date).toBeLessThan(Date.now() / 100);
    expect(tokens.expiry_date).toBeGreaterThan(Date.now() / 1000);
  });

  it("refreshes an expired token and reports it for storage", async () => {
    const stored: unknown[] = [];
    const expired = {
      access_token: "old",
      refresh_token: "rt-old",
      expiry_date: Math.round(Date.now() / 1000) - 10,
    };
    const client = provider().open(expired, async (key) => void stored.push(key));
    expect(await client.listCalendars()).toEqual([
      { id: "cal-main", name: "Calendar", primary: true },
      { id: "cal-team", name: "Team", primary: false },
    ]);
    expect(state.tokenRequests[0].params).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "rt-old",
    });
    expect(stored).toHaveLength(1);
    expect(state.calls.at(-1)?.authorization).toBe(`Bearer ${(stored[0] as OAuthTokens).access_token}`);
  });

  it("reads busy times across pages, skipping free events", async () => {
    state.outlookEvents = [
      {
        id: "1",
        calendarId: "cal-main",
        showAs: "busy",
        start: "2030-01-07T10:00:00.0000000",
        end: "2030-01-07T11:00:00.0000000",
      },
      {
        id: "2",
        calendarId: "cal-main",
        showAs: "free",
        start: "2030-01-07T12:00:00.0000000",
        end: "2030-01-07T13:00:00.0000000",
      },
      {
        id: "3",
        calendarId: "cal-main",
        showAs: "tentative",
        start: "2030-01-07T14:00:00.0000000",
        end: "2030-01-07T15:00:00.0000000",
      },
    ];
    const client = provider().open(
      { access_token: "a", expiry_date: Date.now() / 1000 + 3600 },
      async () => {}
    );
    const busy = await client.busyTimes(
      ["cal-main"],
      new Date("2030-01-07T00:00:00Z"),
      new Date("2030-01-08T00:00:00Z")
    );
    expect(busy).toEqual([
      { start: new Date("2030-01-07T10:00:00Z"), end: new Date("2030-01-07T11:00:00Z") },
      { start: new Date("2030-01-07T14:00:00Z"), end: new Date("2030-01-07T15:00:00Z") },
    ]);
  });

  it("creates events with attendees in UTC and deletes them", async () => {
    const client = provider().open(
      { access_token: "a", expiry_date: Date.now() / 1000 + 3600 },
      async () => {}
    );
    const created = await client.createEvent("cal-team", {
      uid: "b-1",
      summary: "Intro",
      description: "Hello",
      start: new Date("2030-01-07T12:00:00Z"),
      end: new Date("2030-01-07T12:30:00Z"),
      timeZone: "Europe/Berlin",
      location: "https://zoom.us/j/1",
      organizer: { name: "Hana", email: "host@example.com" },
      attendees: [{ email: "greta@example.com", displayName: "Greta" }],
      private: true,
    });
    expect(state.outlookEvents[0]).toMatchObject({ calendarId: "cal-team", start: "2030-01-07T12:00:00" });
    expect(state.outlookEvents[0].body).toMatchObject({
      subject: "Intro",
      location: { displayName: "https://zoom.us/j/1" },
      attendees: [{ emailAddress: { address: "greta@example.com", name: "Greta" }, type: "required" }],
      sensitivity: "private",
    });
    await client.deleteEvent("cal-team", created.id);
    expect(state.outlookEvents).toEqual([]);
  });
});
