import type { GoogleEndpoints } from "./endpoints";
import { GOOGLE_CALENDAR_SCOPES } from "./endpoints";

/** Cal's credential.key shape for Google (googleapis' Credentials), kept so data stays portable. */
async function tokenRequest(
  config: GoogleOAuthConfig,
  params: Record<string, string>,
  fetchImpl: typeof fetch
) {
  const response = await fetchImpl(config.endpoints.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  });
  if (!response.ok)
    throw new Error(`Google token request failed with ${response.status}: ${await response.text()}`);
  const json = (await response.json()) as Omit<GoogleTokens, "expiry_date"> & { expires_in: number };
  const { expires_in, ...tokens } = json;
  return { ...tokens, expiry_date: Date.now() + expires_in * 1000 } satisfies GoogleTokens;
}

export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  endpoints: GoogleEndpoints;
};

export function buildAuthorizeUrl(config: GoogleOAuthConfig, state: string): string {
  const url = new URL(config.endpoints.authorize);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    // offline + consent makes Google return a refresh token every time, even on reconnect.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

export function exchangeCode(config: GoogleOAuthConfig, code: string, fetchImpl: typeof fetch = fetch) {
  return tokenRequest(
    config,
    { grant_type: "authorization_code", code, redirect_uri: config.redirectUri },
    fetchImpl
  );
}

export async function refreshTokens(
  config: GoogleOAuthConfig,
  tokens: GoogleTokens,
  fetchImpl: typeof fetch = fetch
): Promise<GoogleTokens> {
  if (!tokens.refresh_token) throw new Error("Google credential has no refresh token");
  const refreshed = await tokenRequest(
    config,
    { grant_type: "refresh_token", refresh_token: tokens.refresh_token },
    fetchImpl
  );
  // Google omits the refresh token on refresh; keep the one we have.
  return { ...tokens, ...refreshed, refresh_token: refreshed.refresh_token ?? tokens.refresh_token };
}
