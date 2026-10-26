import en from "@calcom/i18n/locales/en/common.json";
import { createServerFn } from "@tanstack/react-start";
import type { Messages } from "~/lib/i18n";

type Catalog = { [key: string]: string | Catalog };

const catalog: Catalog = en;

// Nested groups are addressed with dotted keys, as in i18next ("booking_audit_action.created").
function lookup(key: string): string | undefined {
  const direct = catalog[key];
  if (typeof direct === "string") return direct;
  let node: string | Catalog | undefined = catalog;
  for (const part of key.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

// The full English catalog is ~320 KB, so routes request only the keys they render.
export function pickMessages(keys: readonly string[]): Messages {
  const picked: Messages = {};
  for (const key of keys) {
    const message = lookup(key);
    if (message !== undefined) picked[key] = message;
  }
  return picked;
}

export const getMessages = createServerFn({ method: "GET" })
  .inputValidator((keys: readonly string[]) => keys)
  .handler(({ data }) => pickMessages(data));
