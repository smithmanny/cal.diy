import { useMatches } from "@tanstack/react-router";

type LoaderDataWithMessages = { messages?: Messages } | undefined;

function pluralTemplate(messages: Messages, key: string, count: number, locale: string): string | undefined {
  const category = new Intl.PluralRules(locale).select(count);
  return messages[`${key}_${category}`] ?? messages[`${key}_other`];
}

export type Messages = Record<string, string>;

export type TFunction = (key: string, values?: Record<string, string | number>) => string;

// i18next's plural suffixes, which the locale files use (e.g. "_one", "_other").
export const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

export function createT(messages: Messages, locale = "en"): TFunction {
  return (key, values) => {
    const plural =
      typeof values?.count === "number" ? pluralTemplate(messages, key, values.count, locale) : undefined;
    const template = plural ?? messages[key] ?? key;
    if (!values) return template;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match
    );
  };
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
