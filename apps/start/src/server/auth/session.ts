import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { DEFAULT_LOCALE, localeFromAcceptLanguage, matchLocale } from "~/lib/locales";
import { getAuth } from "./auth";

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
  username: string | null;
  timeZone: string;
};

export type RequestContext = {
  user: SessionUser | null;
  locale: string;
};

/** One session lookup per navigation; the result is shared with every route through router context. */
export const getRequestContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<RequestContext> => {
    const headers = getRequestHeaders();
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers });
    const user = session
      ? {
          id: Number(session.user.id),
          email: session.user.email,
          name: session.user.name || null,
          username: session.user.username ?? null,
          timeZone: session.user.timeZone ?? "Europe/London",
        }
      : null;
    const userLocale = session?.user.locale ? matchLocale(session.user.locale) : null;
    const locale = userLocale ?? localeFromAcceptLanguage(headers.get("accept-language")) ?? DEFAULT_LOCALE;
    return { user, locale };
  }
);
