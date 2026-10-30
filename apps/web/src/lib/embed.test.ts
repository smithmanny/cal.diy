import { describe, expect, it } from "vitest";
import {
  bookingSuccessfulPayload,
  connectedSearch,
  embedEventMessage,
  embedNamespace,
  embedTheme,
  parseParentCommand,
} from "./embed";

describe("embedNamespace", () => {
  it("reads the embed query parameter, even when empty (Cal's default namespace)", () => {
    expect(embedNamespace("?embed=sales", "")).toBe("sales");
    expect(embedNamespace("?embed=", "")).toBe("");
  });

  it("falls back to the iframe name embed.js sets", () => {
    expect(embedNamespace("", "cal-embed=sales")).toBe("sales");
    expect(embedNamespace("", "")).toBeNull();
    expect(embedNamespace("", "other")).toBeNull();
  });
});

describe("embedEventMessage", () => {
  it("uses the CAL:<namespace>:<type> form embed.js parses", () => {
    expect(embedEventMessage("ns", "linkReady", {})).toEqual({
      originator: "CAL",
      type: "linkReady",
      namespace: "ns",
      fullType: "CAL:ns:linkReady",
      data: {},
    });
  });
});

describe("parseParentCommand", () => {
  it("ignores messages that aren't from embed.js", () => {
    expect(parseParentCommand(null)).toBeNull();
    expect(parseParentCommand({ method: "ui" })).toBeNull();
    expect(parseParentCommand({ originator: "CAL", method: "unknown" })).toBeNull();
  });

  it("keeps only the ui settings this page applies", () => {
    expect(
      parseParentCommand({ originator: "CAL", method: "ui", arg: { theme: "dark", styles: {} } })
    ).toEqual({
      method: "ui",
      arg: { theme: "dark" },
    });
    expect(parseParentCommand({ originator: "CAL", method: "ui", arg: { theme: "pink" } })).toEqual({
      method: "ui",
      arg: { theme: undefined },
    });
  });

  it("parses connect and parentKnowsIframeReady", () => {
    expect(parseParentCommand({ originator: "CAL", method: "parentKnowsIframeReady" })).toEqual({
      method: "parentKnowsIframeReady",
    });
    expect(
      parseParentCommand({
        originator: "CAL",
        method: "connect",
        arg: { config: { name: "Ada" }, params: {} },
      })
    ).toEqual({ method: "connect", arg: { config: { name: "Ada" }, params: {} } });
  });
});

describe("embedTheme", () => {
  it("maps auto to following the system and ignores anything else", () => {
    expect(embedTheme("dark")).toBe("dark");
    expect(embedTheme("auto")).toBeNull();
    expect(embedTheme("pink")).toBeUndefined();
    expect(embedTheme(undefined)).toBeUndefined();
  });
});

describe("connectedSearch", () => {
  it("replaces parameters with the connected ones, config winning, without iframeAttrs", () => {
    const search = connectedSearch("?embed=ns&name=Old&layout=month_view", {
      params: { guests: ["a@x.com", "b@x.com"], name: "Param" },
      config: { name: "Ada", iframeAttrs: { id: "x" } },
    });
    expect(Object.fromEntries(new URLSearchParams(search))).toEqual({
      embed: "ns",
      name: "Ada",
      layout: "month_view",
      guests: "b@x.com",
    });
    expect(new URLSearchParams(search).getAll("guests")).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("bookingSuccessfulPayload", () => {
  const booking = { uid: "u1", title: "Intro", status: "ACCEPTED", eventTypeId: 3, durationMinutes: 30 };

  it("describes a single booking", () => {
    expect(bookingSuccessfulPayload({ ...booking, startTimes: ["2030-01-01T10:00:00.000Z"] })).toEqual({
      uid: "u1",
      title: "Intro",
      startTime: "2030-01-01T10:00:00.000Z",
      endTime: "2030-01-01T10:30:00.000Z",
      eventTypeId: 3,
      status: "ACCEPTED",
      paymentRequired: false,
      isRecurring: false,
    });
  });

  it("lists every occurrence of a recurring booking", () => {
    const payload = bookingSuccessfulPayload({
      ...booking,
      startTimes: ["2030-01-01T10:00:00.000Z", "2030-01-08T10:00:00.000Z"],
    });
    expect(payload.isRecurring).toBe(true);
    expect(payload.allBookings).toEqual([
      { startTime: "2030-01-01T10:00:00.000Z", endTime: "2030-01-01T10:30:00.000Z" },
      { startTime: "2030-01-08T10:00:00.000Z", endTime: "2030-01-08T10:30:00.000Z" },
    ]);
  });
});
