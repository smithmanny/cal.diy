/** Third-party endpoints; overridable outside production so the flows can be tested against fakes. */
import process from "node:process";
import { IS_PRODUCTION_BUILD } from "../build";

export type AppEndpoints = {
  /** Microsoft identity platform: `${base}/authorize` and `${base}/token`. */
  microsoftOAuth: string;
  microsoftGraph: string;
  zoomOAuth: string;
  zoomApi: string;
  dailyApi: string;
  appleCalDav: string;
  stripeApi: string;
  /** Stripe Connect's OAuth: `${base}/oauth/authorize` and `${base}/oauth/token`. */
  stripeConnect: string;
};

export function appEndpoints(
  env: Record<string, string | undefined> = process.env,
  allowOverride = !IS_PRODUCTION_BUILD
): AppEndpoints {
  const pick = (name: string, fallback: string) => (allowOverride && env[name]) || fallback;
  return {
    microsoftOAuth: pick("MS_OAUTH_URL", "https://login.microsoftonline.com/common/oauth2/v2.0"),
    microsoftGraph: pick("MS_GRAPH_API_URL", "https://graph.microsoft.com/v1.0"),
    zoomOAuth: pick("ZOOM_OAUTH_URL", "https://zoom.us/oauth"),
    zoomApi: pick("ZOOM_API_URL", "https://api.zoom.us/v2"),
    dailyApi: pick("DAILY_API_URL", "https://api.daily.co/v1"),
    appleCalDav: pick("APPLE_CALDAV_URL", "https://caldav.icloud.com"),
    stripeApi: pick("STRIPE_API_URL", "https://api.stripe.com/v1"),
    stripeConnect: pick("STRIPE_CONNECT_URL", "https://connect.stripe.com"),
  };
}
