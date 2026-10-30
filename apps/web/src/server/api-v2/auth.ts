import "@tanstack/react-start/server-only";

import type { AccessScope } from "@calcom/db/enums";
import { apiKeySecret } from "~/lib/api-keys";
import { getAuth } from "../auth/auth";
import { AppError } from "../errors";
import { getOAuthService } from "../oauth/container";

type ApiUser = { id: number };

const BEARER = /^Bearer\s+(\S+)$/i;
const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/** What READ_PROFILE covers. Webhooks aren't on it: their URLs and templates are the user's own config. */
const PROFILE_PATHS = ["/api/v2/me", "/api/v2/event-types", "/api/v2/schedules", "/api/v2/slots"];

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Cal's OAuth scopes only grant reading: bookings with READ_BOOKING, the profile, event types,
 * schedules and slots with READ_PROFILE, and nothing else.
 */
function oauthScopeFor(method: string, pathname: string): AccessScope | null {
  if (method !== "GET") return null;
  if (under(pathname, "/api/v2/bookings")) return "READ_BOOKING";
  return PROFILE_PATHS.some((prefix) => under(pathname, prefix)) ? "READ_PROFILE" : null;
}

async function authenticateOAuthToken(request: Request, token: string): Promise<ApiUser> {
  const claims = await (await getOAuthService()).verifyAccessToken(token);
  if (!claims) throw new AppError("unauthorized", 401);
  const needed = oauthScopeFor(request.method, new URL(request.url).pathname);
  if (!needed || !claims.scope.includes(needed)) throw new AppError("unauthorized", 403);
  return { id: claims.userId };
}

/**
 * The API key's owner (or the user an OAuth access token was issued for), or null when the
 * request carries no credentials. A key that is wrong, expired or over its rate limit (120
 * requests a minute, as in Cal) is rejected rather than treated as absent.
 */
async function authenticate(request: Request): Promise<ApiUser | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const token = BEARER.exec(header)?.[1];
  if (!token) throw new AppError("unauthorized", 401);
  if (JWT.test(token)) return authenticateOAuthToken(request, token);
  const auth = await getAuth();
  const result = await auth.api.verifyApiKey({ body: { key: apiKeySecret(token) } });
  if (result.error?.code === "RATE_LIMITED") throw new AppError("rate_limit_exceeded", 429);
  const userId = Number(result.key?.referenceId);
  if (!result.valid || !Number.isSafeInteger(userId)) throw new AppError("unauthorized", 401);
  return { id: userId };
}

export type { ApiUser };
export { authenticate, oauthScopeFor };
