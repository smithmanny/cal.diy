import "@tanstack/react-start/server-only";

import process from "node:process";
import type { Database } from "@calcom/db/database";
import { getDb } from "../db";
import { CalendarRepository } from "./CalendarRepository";
import { CalendarService } from "./CalendarService";
import { googleEndpoints } from "./google/endpoints";
import type { GoogleOAuthConfig } from "./google/oauth";

const DEV_ENCRYPTION_KEY = "cal-diy-dev-only-encryption-key!";

function publicUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Same variable Cal uses, so credentials encrypted by an existing Cal install stay readable. */
function encryptionKey(): string | null {
  const key = process.env.CALENDSO_ENCRYPTION_KEY;
  if (key) return key;
  return process.env.NODE_ENV === "production" ? null : DEV_ENCRYPTION_KEY;
}

export function isGoogleCalendarEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && encryptionKey());
}

export function googleRedirectUri(): string {
  return `${publicUrl()}/api/integrations/googlecalendar/callback`;
}

/** One OAuth client serves both "Sign in with Google" and calendar access. */
export function googleOAuthConfig(): GoogleOAuthConfig | null {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: googleRedirectUri(),
    endpoints: googleEndpoints(),
  };
}

/** Null when Google isn't configured, so bookings simply skip calendar sync. */
export function createCalendarService(db: Database): CalendarService | null {
  const oauth = googleOAuthConfig();
  if (!oauth) return null;
  const key = encryptionKey();
  if (!key) {
    // Calendar sync is disabled rather than failing, since this also runs on every booking.
    console.error(
      "Google Calendar is configured but CALENDSO_ENCRYPTION_KEY is not set (openssl rand -base64 24)."
    );
    return null;
  }
  return new CalendarService(new CalendarRepository(db), {
    oauth,
    encryptionKey: key,
    publicUrl: publicUrl(),
  });
}

export async function getCalendarService(): Promise<CalendarService | null> {
  return createCalendarService(await getDb());
}

export function oauthStateSecret(): string {
  return process.env.BETTER_AUTH_SECRET ?? DEV_ENCRYPTION_KEY;
}
