import type { ApiKey } from "@better-auth/api-key/types";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { CAL_API_KEY_PREFIX } from "~/lib/api-keys";
import { getAuth } from "../auth/auth";
import { AppError } from "../errors";
import { authMiddleware } from "../middleware";

const DAY_SECONDS = 24 * 60 * 60;

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const auth = await getAuth();
    const { apiKeys } = await auth.api.listApiKeys({ headers: getRequestHeaders() });
    return apiKeys.map((key: Omit<ApiKey, "key">) => ({
      id: key.id,
      name: key.name,
      // Enough of the key to recognize it; the rest was only shown once, when it was created.
      hint: `${key.prefix ?? CAL_API_KEY_PREFIX}${key.start ?? ""}…`,
      expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString() : null,
      lastRequest: key.lastRequest ? new Date(key.lastRequest).toISOString() : null,
    }));
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(100),
      /** Cal's choices: never, or 7, 30, 90 or 365 days. */
      expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).nullable(),
    })
  )
  .handler(async ({ data }) => {
    const auth = await getAuth();
    const created = await auth.api.createApiKey({
      headers: getRequestHeaders(),
      body: {
        name: data.name,
        prefix: CAL_API_KEY_PREFIX,
        expiresIn: data.expiresInDays ? data.expiresInDays * DAY_SECONDS : undefined,
      },
    });
    if (!created?.key) throw new AppError("something_went_wrong");
    return { key: `${CAL_API_KEY_PREFIX}${created.key}` };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ keyId: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const auth = await getAuth();
    // Better Auth only deletes keys owned by the session's user.
    await auth.api.deleteApiKey({ headers: getRequestHeaders(), body: { keyId: data.keyId } });
  });
