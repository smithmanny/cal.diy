import "@tanstack/react-start/server-only";

import { getCalendarService, googleOAuthConfig } from "../calendars/container";
import { buildAuthorizeUrl } from "../calendars/google/oauth";
import { GOOGLE_CALENDAR_TYPE } from "../calendars/google/provider";
import {
  OFFICE365_CALENDAR_SCOPES,
  OFFICE365_CALENDAR_TYPE,
} from "../calendars/office365/OutlookCalendarClient";
import { getVideoService } from "../video/container";
import { TEAMS_SCOPES, TEAMS_VIDEO_TYPE, ZOOM_VIDEO_TYPE } from "../video/providers";
import { outlookCalendarOAuth, teamsOAuth, zoomOAuth } from "./config";
import { buildOAuthAuthorizeUrl, type OAuthClientConfig } from "./oauth";

/** An app installed through its provider's consent screen, by Cal's folder name (the route segment). */
type OAuthApp = {
  authorizeUrl(state: string): string;
  connect(userId: number, code: string): Promise<void>;
  /** Where the user lands afterwards. */
  returnTo: string;
};

const CALENDARS_PAGE = "/settings/my-account/calendars";
const CONFERENCING_PAGE = "/settings/my-account/conferencing";

async function calendarApp(
  type: string,
  authorizeUrl: ((state: string) => string) | null
): Promise<OAuthApp | null> {
  const service = await getCalendarService();
  if (!authorizeUrl || !service?.hasProvider(type)) return null;
  return {
    authorizeUrl,
    connect: (userId, code) => service.connectOAuth(userId, type, code),
    returnTo: CALENDARS_PAGE,
  };
}

async function videoApp(type: string, oauth: OAuthClientConfig | null): Promise<OAuthApp | null> {
  const service = await getVideoService();
  if (!oauth || !service?.hasProvider(type)) return null;
  return {
    authorizeUrl: (state) => buildOAuthAuthorizeUrl(oauth, state),
    connect: (userId, code) => service.connectOAuth(userId, type, code),
    returnTo: CONFERENCING_PAGE,
  };
}

export async function getOAuthApp(dirName: string): Promise<OAuthApp | null> {
  switch (dirName) {
    case "googlecalendar": {
      const google = googleOAuthConfig();
      return calendarApp(GOOGLE_CALENDAR_TYPE, google && ((state) => buildAuthorizeUrl(google, state)));
    }
    case "office365calendar": {
      const outlook = outlookCalendarOAuth(OFFICE365_CALENDAR_SCOPES);
      return calendarApp(
        OFFICE365_CALENDAR_TYPE,
        outlook && ((state) => buildOAuthAuthorizeUrl(outlook, state))
      );
    }
    case "zoomvideo":
      return videoApp(ZOOM_VIDEO_TYPE, zoomOAuth());
    case "office365video":
      return videoApp(TEAMS_VIDEO_TYPE, teamsOAuth(TEAMS_SCOPES));
    default:
      return null;
  }
}
