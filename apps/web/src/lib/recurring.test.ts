import { describe, expect, it } from "vitest";
import { pickMessages } from "../server/catalog";
import { createT } from "./i18n";
import { RECURRING_MESSAGE_KEYS, recurringSummary } from "./recurring";

describe("recurringSummary", () => {
  it("reads like Cal's", async () => {
    const t = createT(await pickMessages("en", RECURRING_MESSAGE_KEYS));
    expect(recurringSummary({ freq: 2, interval: 1, count: 4 }, t)).toBe("Every week for 4 occurrences");
    expect(recurringSummary({ freq: 1, interval: 2, count: 1 }, t)).toBe("Every 2 months for 1 occurrence");
  });
});
