import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "../admin/middleware";
import { AppError } from "../errors";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getOAuthService } from "./container";
import { OAuthError, parseScopes } from "./OAuthService";

const authorizeSchema = z.object({
  clientId: z.string().min(1).max(200),
  redirectUri: z.string().url().max(2000),
});

/** OAuth errors become AppErrors carrying the OAuth code, which the consent page shows. */
async function asAppError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof OAuthError) throw new AppError(error.error, error.status === 404 ? 404 : 400);
    throw error;
  }
}

export const getOAuthAuthorizeClient = createServerFn({ method: "GET" })
  .validator(authorizeSchema)
  .handler(({ data }) =>
    asAppError(async () => (await getOAuthService()).clientForAuthorization(data.clientId, data.redirectUri))
  );

export const approveOAuthAuthorization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    authorizeSchema.extend({
      scope: z.string().max(500).optional(),
      state: z.string().max(2000).optional(),
      codeChallenge: z.string().max(200).optional(),
      codeChallengeMethod: z.string().max(20).optional(),
    })
  )
  .handler(({ context, data }) =>
    asAppError(async () =>
      (await getOAuthService()).authorize({
        clientId: data.clientId,
        redirectUri: data.redirectUri,
        userId: context.userId,
        scopes: parseScopes(data.scope),
        state: data.state,
        codeChallenge: data.codeChallenge || undefined,
        codeChallengeMethod: data.codeChallengeMethod || undefined,
      })
    )
  );

export const listOAuthClients = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const clients = await (await getOAuthService()).listClients();
    return clients.map(({ createdAt, ...client }) => ({ ...client, createdAt: createdAt.toISOString() }));
  });

export const createOAuthClient = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(200),
      redirectUri: z.string().trim().url().max(2000),
      logo: z.string().trim().url().max(2000).nullable(),
      clientType: z.enum(["CONFIDENTIAL", "PUBLIC"]),
    })
  )
  .handler(async ({ context, data }) =>
    (await getOAuthService()).createClient({ ...data, userId: context.adminId })
  );

export const deleteOAuthClient = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ clientId: z.string().min(1).max(200) }))
  .handler(async ({ data }) => (await getOAuthService()).deleteClient(data.clientId));
