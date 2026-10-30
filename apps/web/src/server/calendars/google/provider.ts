import type { CalendarProvider } from "../types";
import { GoogleCalendarClient } from "./GoogleCalendarClient";
import { exchangeCode, type GoogleOAuthConfig, type GoogleTokens } from "./oauth";

export const GOOGLE_CALENDAR_TYPE = "google_calendar";

export function googleCalendarProvider(
  config: GoogleOAuthConfig,
  fetchImpl: typeof fetch = fetch
): CalendarProvider {
  return {
    type: GOOGLE_CALENDAR_TYPE,
    open: (key, onKeyChange) => new GoogleCalendarClient(key as GoogleTokens, config, onKeyChange, fetchImpl),
    exchangeCode: (code) => exchangeCode(config, code, fetchImpl),
    async revoke(key) {
      const tokens = key as GoogleTokens;
      const token = tokens.refresh_token ?? tokens.access_token;
      await fetchImpl(`${config.endpoints.revoke}?token=${encodeURIComponent(token)}`, { method: "POST" });
    },
  };
}
