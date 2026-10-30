import "@tanstack/react-start/server-only";

import { getCalendarService, googleOAuthConfig } from "../calendars/container";
import { buildAuthorizeUrl } from "../calendars/google/oauth";
import { GOOGLE_CALENDAR_TYPE } from "../calendars/google/provider";
import {
  OFFICE365_CALENDAR_SCOPES,
  OFFICE365_CALENDAR_TYPE,
} from "../calendars/office365/OutlookCalendarClient";
import { createStripeClient, getPaymentService } from "../payments/container";
import { getVideoService } from "../video/container";
import { TEAMS_SCOPES, TEAMS_VIDEO_TYPE, ZOOM_VIDEO_TYPE } from "../video/providers";
import { integrationRedirectUri, outlookCalendarOAuth, teamsOAuth, zoomOAuth } from "./config";
import { buildOAuthAuthorizeUrl, type OAuthClientConfig } from "./oauth";

/** An app installed through its provider's consent screen, by Cal's folder name (the route segment). */
type OAuthApp = {
  /** `user` prefills Stripe's account form; other providers ignore it. */
  authorizeUrl(state: string, user: { email: string; name: string | null }): string;
  connect(userId: number, code: string): Promise<void>;
  /** Where the user lands afterwards. */
  returnTo: string;
};

const CALENDARS_PAGE = "/settings/my-account/calendars";
const CONFERENCING_PAGE = "/settings/my-account/conferencing";

/** Stripe Connect: the host's own Stripe account receives the payments for their events. */
async function stripeApp(): Promise<OAuthApp | null> {
  const [stripe, payments] = [createStripeClient(), await getPaymentService()];
  if (!stripe || !payments) return null;
  return {
    authorizeUrl: (state, user) => stripe.authorizeUrl(state, integrationRedirectUri("stripepayment"), user),
    connect: async (userId, code) => payments.connect(userId, await stripe.connect(code)),
    returnTo: "/apps",
  };
}

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
    case "stripepayment":
      return stripeApp();
    default:
      return null;
  }
}
