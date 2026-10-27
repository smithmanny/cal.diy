import "@tanstack/react-start/server-only";

import { apiKeySecret } from "~/lib/api-keys";
import { getAuth } from "../auth/auth";
import { AppError } from "../errors";

type ApiUser = { id: number };

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * The API key's owner, or null when the request carries no key. A key that is wrong, expired or
 * over its rate limit (120 requests a minute, as in Cal) is rejected rather than treated as absent.
 */
async function authenticate(request: Request): Promise<ApiUser | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const token = BEARER.exec(header)?.[1];
  if (!token) throw new AppError("unauthorized", 401);
  const auth = await getAuth();
  const result = await auth.api.verifyApiKey({ body: { key: apiKeySecret(token) } });
  if (result.error?.code === "RATE_LIMITED") throw new AppError("rate_limit_exceeded", 429);
  const userId = Number(result.key?.referenceId);
  if (!result.valid || !Number.isSafeInteger(userId)) throw new AppError("unauthorized", 401);
  return { id: userId };
}

export type { ApiUser };
export { authenticate };
