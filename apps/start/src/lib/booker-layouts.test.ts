import { describe, expect, it } from "vitest";
import { DEFAULT_BOOKER_LAYOUTS, effectiveBookerLayouts, initialLayout } from "./booker-layouts";

describe("booker layouts", () => {
  const weekOnly = { enabledLayouts: ["week_view"], defaultLayout: "week_view" };

  it("prefers the event's layouts, then the user's, then Cal's defaults", () => {
    expect(effectiveBookerLayouts(weekOnly, null)).toEqual(weekOnly);
    expect(effectiveBookerLayouts(null, weekOnly)).toEqual(weekOnly);
    expect(effectiveBookerLayouts({ enabledLayouts: [], defaultLayout: "week_view" }, undefined)).toEqual(
      DEFAULT_BOOKER_LAYOUTS
    );
    expect(
      effectiveBookerLayouts({ enabledLayouts: ["month_view"], defaultLayout: "week_view" }, null)
    ).toEqual(DEFAULT_BOOKER_LAYOUTS);
  });

  it("honors ?layout= only for an enabled layout", () => {
    expect(initialLayout(DEFAULT_BOOKER_LAYOUTS, "column_view")).toBe("column_view");
    expect(initialLayout({ enabledLayouts: ["week_view"], defaultLayout: "week_view" }, "column_view")).toBe(
      "week_view"
    );
    expect(initialLayout(DEFAULT_BOOKER_LAYOUTS, 42)).toBe("month_view");
  });
});
