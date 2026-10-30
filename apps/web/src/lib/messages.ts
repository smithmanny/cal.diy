import { getMessages } from "~/server/i18n";

/** Loader helper: fetches the given translation keys for the request's locale. */
export function loadMessages(context: { locale: string }, keys: readonly string[]) {
  return getMessages({ data: { locale: context.locale, keys } });
}
