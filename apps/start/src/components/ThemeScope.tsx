import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { DEFAULT_BRAND_COLOR, DEFAULT_DARK_BRAND_COLOR, isHexColor, textColorOn } from "~/lib/brand-color";
import type { ThemePreference } from "~/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function brandStyle(brandColor?: string | null, darkBrandColor?: string | null): CSSProperties | undefined {
  const light =
    brandColor && isHexColor(brandColor) && brandColor !== DEFAULT_BRAND_COLOR ? brandColor : null;
  const dark =
    darkBrandColor && isHexColor(darkBrandColor) && darkBrandColor !== DEFAULT_DARK_BRAND_COLOR
      ? darkBrandColor
      : null;
  if (!light && !dark) return undefined;
  // Read by the [data-brand] rules in styles.css, which pick the light or dark pair.
  return {
    "--brand-color": light ?? "var(--color-neutral-800)",
    "--brand-text": light ? textColorOn(light) : "var(--color-neutral-50)",
    "--brand-color-dark": dark ?? "var(--color-neutral-100)",
    "--brand-text-dark": dark ? textColorOn(dark) : "var(--color-neutral-800)",
  } as CSSProperties;
}

/**
 * Applies a theme to a subtree, since public pages follow the host's theme and the dashboard the
 * user's. `null` follows the visitor's system setting: an inline script sets it before first paint
 * and an effect keeps it in sync after client-side navigation and system changes.
 */
export function ThemeScope({
  theme,
  brandColor,
  darkBrandColor,
  className = "",
  children,
}: {
  theme: ThemePreference;
  brandColor?: string | null;
  darkBrandColor?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || theme) return;
    const media = matchMedia(DARK_QUERY);
    const apply = () => element.classList.toggle("dark", media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const brand = brandStyle(brandColor, darkBrandColor);
  return (
    <div
      ref={ref}
      // The system-theme script may add "dark" before React hydrates.
      suppressHydrationWarning
      data-theme-scope=""
      data-brand={brand ? "" : undefined}
      style={brand}
      className={`min-h-screen bg-background text-foreground ${theme === "dark" ? "dark" : ""} ${className}`}>
      {theme === null && (
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant, no user input
          dangerouslySetInnerHTML={{
            __html: `matchMedia(${JSON.stringify(DARK_QUERY)}).matches&&document.currentScript.parentElement.classList.add("dark")`,
          }}
        />
      )}
      {children}
    </div>
  );
}
