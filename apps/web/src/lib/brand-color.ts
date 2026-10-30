const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

// Cal's defaults; a host who never picked a color keeps the theme's own primary.
export const DEFAULT_BRAND_COLOR = "#292929";
export const DEFAULT_DARK_BRAND_COLOR = "#fafafa";

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

/** WCAG contrast ratio between two #rrggbb colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Black or white, whichever reads better on `background`. */
export function textColorOn(background: string): string {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#111111") ? "#ffffff" : "#111111";
}

/**
 * Cal warns (but still saves) when a button color would be hard to see on the page background:
 * white for the light theme, near-black for the dark one. 4.5 is WCAG AA for normal text.
 */
export function passesContrast(color: string, theme: "light" | "dark"): boolean {
  return contrastRatio(color, theme === "light" ? "#ffffff" : "#101010") >= 4.5;
}
