import "@tanstack/react-start/server-only";

import type { Messages } from "~/lib/i18n";
import { nestedKeys, PLURAL_SUFFIXES } from "~/lib/i18n";
import { DEFAULT_LOCALE, matchLocale } from "~/lib/locales";
import { readStaticAsset } from "#runtime";

type Catalog = { [key: string]: string | Catalog };

const catalogs = new Map<string, Promise<Catalog | null>>();

function loadCatalog(locale: string): Promise<Catalog | null> {
  let catalog = catalogs.get(locale);
  if (!catalog) {
    catalog = readStaticAsset(`locales/${locale}.json`).then((text) =>
      text ? (JSON.parse(text) as Catalog) : null
    );
    catalogs.set(locale, catalog);
  }
  return catalog;
}

// Nested groups are addressed with dotted keys, as in i18next ("booking_audit_action.created").
function lookup(catalog: Catalog | null, key: string): string | undefined {
  if (!catalog) return undefined;
  const direct = catalog[key];
  if (typeof direct === "string") return direct;
  let node: string | Catalog | undefined = catalog;
  for (const part of key.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Returns only the requested keys (the English catalog alone is ~320 KB), falling back to
 * English for keys a translation is missing.
 */
export async function pickMessages(locale: string, keys: readonly string[]): Promise<Messages> {
  const [primary, fallback] = await Promise.all([
    loadCatalog(matchLocale(locale) ?? DEFAULT_LOCALE),
    loadCatalog(DEFAULT_LOCALE),
  ]);
  const picked: Messages = {};
  const pending = [...keys];
  while (pending.length) {
    const key = pending.pop() as string;
    for (const variant of [key, ...PLURAL_SUFFIXES.map((suffix) => `${key}${suffix}`)]) {
      if (variant in picked) continue;
      const message = lookup(primary, variant) ?? lookup(fallback, variant);
      if (message === undefined) continue;
      picked[variant] = message;
      // Messages that nest others ($t(minute_timeUnit)) need those too.
      pending.push(...nestedKeys(message).filter((nested) => !(nested in picked)));
    }
  }
  return picked;
}
