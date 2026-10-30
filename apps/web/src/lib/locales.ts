import i18nConfig from "../../../../i18n.json";

const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

export const DEFAULT_LOCALE = i18nConfig.locale.source;
export const SUPPORTED_LOCALES: readonly string[] = [i18nConfig.locale.source, ...i18nConfig.locale.targets];

export function localeDirection(locale: string): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale.split("-")[0]) ? "rtl" : "ltr";
}

/** Maps a requested locale (e.g. "de-AT", "zh") onto one we ship, or null. */
export function matchLocale(requested: string): string | null {
  const normalized = requested.trim();
  if (!normalized) return null;
  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;
  const language = normalized.split("-")[0].toLowerCase();
  if (language === "zh") return "zh-CN";
  return SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === language) ?? null;
}

/** Picks the best supported locale from an Accept-Language header, honoring q-values. */
export function localeFromAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((param) => param.trim().startsWith("q="));
      return { tag, quality: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);
  for (const { tag } of ranked) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return null;
}
