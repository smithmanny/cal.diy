export type ThemePreference = "light" | "dark" | null;

/** Cal stores "light", "dark", or null for "follow the system". */
export function toThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : null;
}
