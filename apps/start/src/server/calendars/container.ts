import "@tanstack/react-start/server-only";

import process from "node:process";
import type { Database } from "@calcom/db/database";
import { CredentialRepository } from "../apps/CredentialRepository";
import { CredentialVault } from "../apps/CredentialVault";
import { encryptionKey, integrationRedirectUri, outlookCalendarOAuth, publicUrl } from "../apps/config";
import { appEndpoints } from "../apps/endpoints";
import { getDb } from "../db";
import { CalendarRepository } from "./CalendarRepository";
import { CalendarService } from "./CalendarService";
import { appleCalendarProvider, calDavProvider } from "./caldav/CalDavClient";
import { googleEndpoints } from "./google/endpoints";
import type { GoogleOAuthConfig } from "./google/oauth";
import { googleCalendarProvider } from "./google/provider";
import { OFFICE365_CALENDAR_SCOPES, outlookCalendarProvider } from "./office365/OutlookCalendarClient";
import type { CalendarProvider } from "./types";

/** Calendar apps this instance can use: OAuth apps need their client configured; CalDAV always works. */
function calendarProviders(): CalendarProvider[] {
  const google = googleOAuthConfig();
  const outlook = outlookCalendarOAuth(OFFICE365_CALENDAR_SCOPES);
  const endpoints = appEndpoints();
  return [
    ...(google ? [googleCalendarProvider(google)] : []),
    ...(outlook ? [outlookCalendarProvider(outlook, endpoints.microsoftGraph)] : []),
    calDavProvider(),
    appleCalendarProvider(endpoints.appleCalDav),
  ];
}

let warnedAboutKey = false;

/** One OAuth client serves both "Sign in with Google" and calendar access. */
export function googleOAuthConfig(): GoogleOAuthConfig | null {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: integrationRedirectUri("googlecalendar"),
    endpoints: googleEndpoints(),
  };
}

/** Null without an encryption key, so bookings simply skip calendar sync. */
export function createCalendarService(db: Database): CalendarService | null {
  const key = encryptionKey();
  if (!key) {
    // Calendar sync is disabled rather than failing, since this also runs on every booking.
    if (!warnedAboutKey)
      console.error("Calendar apps need CALENDSO_ENCRYPTION_KEY (openssl rand -base64 24).");
    warnedAboutKey = true;
    return null;
  }
  return new CalendarService(new CalendarRepository(db), new CredentialRepository(db), {
    providers: calendarProviders(),
    vault: new CredentialVault(key),
    publicUrl: publicUrl(),
  });
}

export async function getCalendarService(): Promise<CalendarService | null> {
  return createCalendarService(await getDb());
}
