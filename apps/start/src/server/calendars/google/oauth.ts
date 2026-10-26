import type { GoogleEndpoints } from "./endpoints";
import { GOOGLE_CALENDAR_SCOPES } from "./endpoints";

/** Cal's credential.key shape for Google (googleapis' Credentials), kept so data stays portable. */
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

/** HMAC-signed OAuth state binding the callback to the user who started it, valid for 10 minutes. */
export async function signState(userId: number, secret: string, now = Date.now()): Promise<string> {
  const payload = `${userId}.${now + 10 * 60_000}.${crypto.randomUUID()}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyState(state: string, secret: string, now = Date.now()): Promise<number | null> {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [userId, expires, nonce, signature] = parts;
  const expected = await hmac(secret, `${userId}.${expires}.${nonce}`);
  if (!timingSafeEqual(signature, expected) || Number(expires) < now) return null;
  return Number(userId);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
