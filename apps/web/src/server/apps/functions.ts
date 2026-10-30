import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getAppsService } from "./container";

const slugSchema = z.object({ slug: z.string().min(1).max(100) });
const teamIdSchema = z.number().int().positive().nullable();

export const getApps = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getAppsService()).listApps(context.userId));

export const getAppInstallTeams = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getAppsService()).installTeams(context.userId));

export const installApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(slugSchema.extend({ teamId: teamIdSchema.optional() }))
  .handler(async ({ context, data }) =>
    (await getAppsService()).install(context.userId, data.slug, data.teamId ?? null)
  );

export const connectCalDavApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    slugSchema.extend({
      url: z.string().trim().max(2000).optional(),
      username: z.string().trim().min(1).max(500),
      password: z.string().min(1).max(500),
    })
  )
  .handler(async ({ context, data }) => {
    const { slug, ...input } = data;
    await (await getAppsService()).connectCalDav(context.userId, slug, input);
  });

export const uninstallApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ credentialId: z.number().int().positive() }))
  .handler(async ({ context, data }) =>
    (await getAppsService()).uninstall(context.userId, data.credentialId)
  );

export const getConferencingSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId: teamIdSchema }).optional())
  .handler(async ({ context, data }) =>
    (await getAppsService()).conferencing(context.userId, data?.teamId ?? null)
  );

export const setDefaultConferencingApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(slugSchema.extend({ link: z.string().trim().url().max(2000).nullable() }))
  .handler(async ({ context, data }) =>
    (await getAppsService()).setDefaultConferencingApp(context.userId, data.slug, data.link)
  );
