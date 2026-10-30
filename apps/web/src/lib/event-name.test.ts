import { describe, expect, it } from "vitest";
import { getEventName } from "./event-name";

const base = {
  template: null,
  eventTypeTitle: "Intro",
  host: "Hana Host",
  attendeeName: "Greta Guest",
  locationLabel: "Google Meet",
  eventDuration: 30,
  responses: {},
  defaultTemplate: "{{eventName}} between {{host}} and {{attendeeName}}",
};

describe("getEventName", () => {
  it("uses Cal's default without a template", () => {
    expect(getEventName(base)).toBe("Intro between Hana Host and Greta Guest");
  });

  it("fills Cal's variables and booking answers, dropping unknown ones", () => {
    expect(
      getEventName({
        ...base,
        template: "{Event type title}: {ATTENDEE} & {Organiser first name} @ {LOCATION} [{size}] {nope}",
        responses: { size: ["a", "b"], location: { value: "x" } },
      })
    ).toBe("Intro: Greta Guest & Hana @ Google Meet [a, b]");
  });

  it("falls back to the event title when nothing is left", () => {
    expect(getEventName({ ...base, template: "{nope}" })).toBe("Intro");
  });
});
