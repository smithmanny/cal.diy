import "@tanstack/react-start/server-only";

import process from "node:process";
import { IS_PRODUCTION_BUILD } from "../build";
import { appEndpoints } from "./endpoints";
import type { OAuthClientConfig } from "./oauth";

const DEV_ENCRYPTION_KEY = "cal-diy-dev-only-encryption-key!";

/** One Microsoft app (MS_GRAPH_CLIENT_ID/SECRET, as in Cal) serves Outlook Calendar and Teams. */
function microsoftOAuth(dirName: string, scopes: string[]): OAuthClientConfig | null {
  const { MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET } = process.env;
  if (!MS_GRAPH_CLIENT_ID || !MS_GRAPH_CLIENT_SECRET) return null;
  const base = appEndpoints().microsoftOAuth;
  return {
    clientId: MS_GRAPH_CLIENT_ID,
    clientSecret: MS_GRAPH_CLIENT_SECRET,
    redirectUri: integrationRedirectUri(dirName),
    authorizeUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
    scopes,
    authorizeParams: { response_mode: "query", prompt: "select_account" },
    clientAuth: "body",
    expiryUnit: "s",
  };
}

export function publicUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Same variable Cal uses, so credentials encrypted by an existing Cal install stay readable. */
export function encryptionKey(): string | null {
  const key = process.env.CALENDSO_ENCRYPTION_KEY;
  if (key) return key;
  return IS_PRODUCTION_BUILD ? null : DEV_ENCRYPTION_KEY;
}

export function oauthStateSecret(): string {
  return process.env.BETTER_AUTH_SECRET ?? DEV_ENCRYPTION_KEY;
}

/** Cal's callback paths (/api/integrations/<dirName>/callback), so registered redirect URIs keep working. */
export function integrationRedirectUri(dirName: string): string {
  return `${publicUrl()}/api/integrations/${dirName}/callback`;
}

export function outlookCalendarOAuth(scopes: string[]): OAuthClientConfig | null {
  return microsoftOAuth("office365calendar", scopes);
}

export function teamsOAuth(scopes: string[]): OAuthClientConfig | null {
  return microsoftOAuth("office365video", scopes);
}

export function zoomOAuth(): OAuthClientConfig | null {
  const { ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) return null;
  const base = appEndpoints().zoomOAuth;
  return {
    clientId: ZOOM_CLIENT_ID,
    clientSecret: ZOOM_CLIENT_SECRET,
    redirectUri: integrationRedirectUri("zoomvideo"),
    authorizeUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
    // Zoom's scopes come from the app's settings in the Zoom marketplace.
    scopes: [],
    clientAuth: "basic",
    expiryUnit: "ms",
  };
}

export function dailyApiKey(): string | null {
  return process.env.DAILY_API_KEY || null;
}

/** Where Jitsi rooms live; Cal's default is meet.jit.si under a "cal" prefix. */
export function jitsiHost(): string {
  return (process.env.JITSI_HOST || "https://meet.jit.si/cal").replace(/\/+$/, "");
}
