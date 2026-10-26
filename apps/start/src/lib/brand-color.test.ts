import { describe, expect, it } from "vitest";
import { contrastRatio, isHexColor, passesContrast, textColorOn } from "./brand-color";

describe("brand colors", () => {
  it("validates #rrggbb only", () => {
    expect(isHexColor("#12abEF")).toBe(true);
    expect(isHexColor("12abef")).toBe(false);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("#12abef; color: red")).toBe(false);
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  it("picks readable button text and flags low-contrast brand colors", () => {
    expect(textColorOn("#1d4ed8")).toBe("#ffffff");
    expect(textColorOn("#fde047")).toBe("#111111");
    expect(passesContrast("#1d4ed8", "light")).toBe(true);
    expect(passesContrast("#fde047", "light")).toBe(false);
    expect(passesContrast("#fde047", "dark")).toBe(true);
  });
});
