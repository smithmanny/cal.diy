import { useMatches } from "@tanstack/react-router";

type LoaderDataWithMessages = { messages?: Messages } | undefined;

// i18next nesting: $t(key) or $t(key, {"count": 2}), resolved after {{value}} interpolation.
const NESTING = /\$t\(([\w.-]+)(?:,\s*(\{[^)]*\}))?\s*\)/g;

function nestedValues(json: string | undefined): Record<string, string | number> | undefined {
  if (!json) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string | number>) : undefined;
  } catch {
    return undefined;
  }
}

function pluralTemplate(messages: Messages, key: string, count: number, locale: string): string | undefined {
  const category = new Intl.PluralRules(locale).select(count);
  return messages[`${key}_${category}`] ?? messages[`${key}_other`];
}

export type Messages = Record<string, string>;

export type TFunction = (key: string, values?: Record<string, string | number>) => string;

// i18next's plural suffixes, which the locale files use (e.g. "_one", "_other").
export const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

/** Keys a message pulls in through $t(...), so loaders can fetch them too. */
export function nestedKeys(message: string): string[] {
  return [...message.matchAll(NESTING)].map((match) => match[1]);
}

export function createT(messages: Messages, locale = "en"): TFunction {
  const t: TFunction = (key, values) => {
    const plural =
      typeof values?.count === "number" ? pluralTemplate(messages, key, values.count, locale) : undefined;
    const template = plural ?? messages[key] ?? key;
    const interpolated = values
      ? template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
          name in values ? String(values[name]) : match
        )
      : template;
    return interpolated.replace(NESTING, (_, nested: string, json?: string) => t(nested, nestedValues(json)));
  };
  return t;
}

/** Translates with the messages loaded by every matched route (layouts and the page). */
export function useT(): TFunction {
  const matches = useMatches();
  const messages: Messages = {};
  for (const match of matches) {
    Object.assign(messages, (match.loaderData as LoaderDataWithMessages)?.messages);
  }
  const locale = (matches[0]?.context as { locale?: string } | undefined)?.locale;
  return createT(messages, locale);
}
