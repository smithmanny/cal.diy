/** Google's endpoints; overridable outside production so the OAuth flow can be tested against a fake. */
import process from "node:process";
import { IS_PRODUCTION_BUILD } from "../../build";

export type GoogleEndpoints = { authorize: string; token: string; revoke: string; calendarApi: string };

export function googleEndpoints(
  env: Record<string, string | undefined> = process.env,
  allowOverride = !IS_PRODUCTION_BUILD
): GoogleEndpoints {
  const pick = (name: string, fallback: string) => (allowOverride && env[name]) || fallback;
  return {
    authorize: pick("GOOGLE_OAUTH_AUTHORIZE_URL", "https://accounts.google.com/o/oauth2/v2/auth"),
    token: pick("GOOGLE_OAUTH_TOKEN_URL", "https://oauth2.googleapis.com/token"),
    revoke: pick("GOOGLE_OAUTH_REVOKE_URL", "https://oauth2.googleapis.com/revoke"),
    calendarApi: pick("GOOGLE_CALENDAR_API_URL", "https://www.googleapis.com/calendar/v3"),
  };
}

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];
