import { describe, expect, it } from "vitest";
import { buildCalendarObject, busyFromIcs, parseDuration, parseIcsDate } from "./ical";
import { decodeXmlText, parseMultistatus } from "./xml";

const event = (lines: string[]) =>
  ["BEGIN:VCALENDAR", "BEGIN:VEVENT", ...lines, "END:VEVENT", "END:VCALENDAR"].join("\r\n");

describe("parseIcsDate", () => {
  it("reads UTC, zoned and all-day values", () => {
    expect(parseIcsDate({ name: "DTSTART", params: {}, value: "20300107T100000Z" })).toEqual({
      date: new Date("2030-01-07T10:00:00Z"),
      allDay: false,
    });
    // New York is UTC-5 in January and UTC-4 in July.
    expect(
      parseIcsDate({ name: "DTSTART", params: { TZID: "America/New_York" }, value: "20300107T100000" })?.date
    ).toEqual(new Date("2030-01-07T15:00:00Z"));
    expect(
      parseIcsDate({ name: "DTSTART", params: { TZID: "America/New_York" }, value: "20300707T100000" })?.date
    ).toEqual(new Date("2030-07-07T14:00:00Z"));
    expect(parseIcsDate({ name: "DTSTART", params: { VALUE: "DATE" }, value: "20300107" })).toEqual({
      date: new Date("2030-01-07T00:00:00Z"),
      allDay: true,
    });
    // A zone Intl doesn't know (e.g. a Windows name) is read as UTC rather than dropped.
    expect(
      parseIcsDate({ name: "DTSTART", params: { TZID: "W. Europe Standard Time" }, value: "20300107T100000" })
        ?.date
    ).toEqual(new Date("2030-01-07T10:00:00Z"));
    expect(parseIcsDate({ name: "DTSTART", params: {}, value: "garbage" })).toBeNull();
  });

  it("reads durations", () => {
    expect(parseDuration("PT1H30M")).toBe(90 * 60_000);
    expect(parseDuration("P1DT2H")).toBe(26 * 3_600_000);
    expect(parseDuration("P1W")).toBe(7 * 86_400_000);
    expect(parseDuration("nope")).toBeNull();
  });
});

describe("busyFromIcs", () => {
  it("uses DTEND, DURATION or a day, and skips free and cancelled events", () => {
    const ics = [
      event(["DTSTART:20300107T100000Z", "DTEND:20300107T110000Z"]),
      event(["DTSTART:20300107T120000Z", "DURATION:PT30M"]),
      event(["DTSTART;VALUE=DATE:20300108"]),
      event(["DTSTART:20300107T130000Z", "DTEND:20300107T140000Z", "TRANSP:TRANSPARENT"]),
      event(["DTSTART:20300107T150000Z", "DTEND:20300107T160000Z", "STATUS:CANCELLED"]),
    ].join("\r\n");
    expect(busyFromIcs(ics)).toEqual([
      { start: new Date("2030-01-07T10:00:00Z"), end: new Date("2030-01-07T11:00:00Z") },
      { start: new Date("2030-01-07T12:00:00Z"), end: new Date("2030-01-07T12:30:00Z") },
      { start: new Date("2030-01-08T00:00:00Z"), end: new Date("2030-01-09T00:00:00Z") },
    ]);
  });

  it("unfolds long lines", () => {
    expect(busyFromIcs(event(["DTSTART:20300107T1", " 00000Z", "DTEND:20300107T110000Z"]))).toHaveLength(1);
  });
});

describe("buildCalendarObject", () => {
  it("escapes text, has no METHOD, and keeps servers from emailing attendees", () => {
    const ics = buildCalendarObject({
      uid: "b-1",
      summary: "Intro; with, Greta",
      description: "Line 1\nLine 2",
      start: new Date("2030-01-07T12:00:00Z"),
      end: new Date("2030-01-07T12:30:00Z"),
      timeZone: "UTC",
      location: "Room 1",
      organizer: { name: "Hana", email: "host@example.com" },
      attendees: [{ email: "greta@example.com", displayName: "Greta" }],
      private: true,
    });
    expect(ics).not.toContain("METHOD:");
    expect(ics).toContain("SUMMARY:Intro\\; with\\, Greta");
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2");
    expect(ics).toContain("DTSTART:20300107T120000Z");
    expect(ics).toContain("CLASS:PRIVATE");
    expect(ics.replace(/\r\n /g, "")).toContain(
      'ATTENDEE;CN="Greta";PARTSTAT=NEEDS-ACTION;SCHEDULE-AGENT=CLIENT:mailto:greta@example.com'
    );
  });
});

describe("parseMultistatus", () => {
  it("ignores namespace prefixes and failed propstats, and decodes text", () => {
    const xml = `<multistatus xmlns="DAV:"><response><href>/a%20b/</href>
      <propstat><prop><displayname>A &amp; B</displayname></prop><status>HTTP/1.1 200 OK</status></propstat>
      <propstat><prop><getctag/></prop><status>HTTP/1.1 404 Not Found</status></propstat></response></multistatus>`;
    const [only] = parseMultistatus(xml);
    expect(only.href).toBe("/a%20b/");
    expect(only.props).toContain("A &amp; B");
    expect(only.props).not.toContain("getctag");
    expect(decodeXmlText("<![CDATA[BEGIN:VCALENDAR]]>")).toBe("BEGIN:VCALENDAR");
    expect(decodeXmlText("A &amp; B &#65;")).toBe("A & B A");
  });
});
