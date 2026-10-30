import { beforeEach, describe, expect, it } from "vitest";
import { appleCalendarProvider, CalDavClient } from "./CalDavClient";
import { createFakeCalDavState, FAKE_CALDAV_USER, type FakeCalDavState, fakeCalDavFetch } from "./fakeCalDav";

const BASE = "https://dav.test/dav/";
const WORK = "https://dav.test/dav/calendars/cal/work/";
let state: FakeCalDavState;
let client: CalDavClient;

beforeEach(() => {
  state = createFakeCalDavState();
  client = new CalDavClient({ url: BASE, ...FAKE_CALDAV_USER }, fakeCalDavFetch(state));
});

describe("CalDavClient", () => {
  it("discovers the event calendars through the principal and calendar home", async () => {
    expect(await client.listCalendars()).toEqual([{ id: WORK, name: "Work", primary: true }]);
    expect(state.requests.map((request) => `${request.method} ${request.path} ${request.depth}`)).toEqual([
      "PROPFIND /dav/ 0",
      "PROPFIND /dav/principals/cal/ 0",
      "PROPFIND /dav/calendars/cal/ 1",
    ]);
  });

  it("fails on a wrong password, so a bad login is never stored", async () => {
    const wrong = new CalDavClient({ url: BASE, username: "cal", password: "nope" }, fakeCalDavFetch(state));
    await expect(wrong.listCalendars()).rejects.toThrow(/401/);
  });

  it("reads busy times from REPORT, keeping only those in range", async () => {
    state.busy = [
      { start: "2030-01-07T10:00:00Z", end: "2030-01-07T11:00:00Z" },
      { start: "2030-02-01T10:00:00Z", end: "2030-02-01T11:00:00Z" },
    ];
    const busy = await client.busyTimes(
      [WORK],
      new Date("2030-01-07T00:00:00Z"),
      new Date("2030-01-08T00:00:00Z")
    );
    expect(busy).toEqual([
      { start: new Date("2030-01-07T10:00:00Z"), end: new Date("2030-01-07T11:00:00Z") },
    ]);
  });

  it("puts events as <uid>.ics, sees them as busy, and deletes them", async () => {
    const created = await client.createEvent(WORK, {
      uid: "booking-1",
      summary: "Intro",
      description: "Hello",
      start: new Date("2030-01-07T12:00:00Z"),
      end: new Date("2030-01-07T12:30:00Z"),
      timeZone: "UTC",
      location: null,
      organizer: { name: "Hana", email: "host@example.com" },
      attendees: [{ email: "greta@example.com", displayName: "Greta" }],
    });
    expect(created).toEqual({ id: "booking-1", meetUrl: null });
    expect(state.events.get("booking-1")).toContain("SUMMARY:Intro");
    const busy = await client.busyTimes(
      [WORK],
      new Date("2030-01-07T00:00:00Z"),
      new Date("2030-01-08T00:00:00Z")
    );
    expect(busy).toEqual([
      { start: new Date("2030-01-07T12:00:00Z"), end: new Date("2030-01-07T12:30:00Z") },
    ]);

    await client.deleteEvent(WORK, "booking-1");
    expect(state.events.size).toBe(0);
    // Already gone counts as deleted.
    await expect(client.deleteEvent(WORK, "booking-1")).resolves.toBeUndefined();
  });

  it("signs Apple in at the fixed iCloud address, whatever the stored key says", async () => {
    const apple = appleCalendarProvider(BASE, fakeCalDavFetch(state)).open(
      { ...FAKE_CALDAV_USER, url: "https://elsewhere.test/" },
      async () => {}
    );
    expect(await apple.listCalendars()).toHaveLength(1);
    expect(state.requests[0].path).toBe("/dav/");
  });
});
