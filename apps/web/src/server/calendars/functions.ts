import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { APPS, appLogoUrl } from "~/lib/apps";
import { AppError } from "../errors";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getCalendarService } from "./container";

const calendarSchema = z.object({
  credentialId: z.number().int().positive(),
  calendarId: z.string().min(1).max(500),
});

async function requireService() {
  const service = await getCalendarService();
  if (!service) throw new AppError("not_found", 404);
  return service;
}

export const getCalendarSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const service = await getCalendarService();
    return {
      enabled: service !== null,
      // Calendar apps this instance can connect, in the registry's order.
      apps: service
        ? APPS.filter((app) => app.category === "calendar" && service.hasProvider(app.credentialType)).map(
            (app) => ({
              slug: app.slug,
              dirName: app.dirName,
              name: app.name,
              logoUrl: appLogoUrl(app),
              credentialType: app.credentialType,
              install: app.install,
            })
          )
        : [],
      connections: service ? await service.listConnections(context.userId) : [],
    };
  });

export const setCalendarSelected = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(calendarSchema.extend({ selected: z.boolean() }))
  .handler(async ({ context, data }) =>
    (await requireService()).setSelected(context.userId, data.credentialId, data.calendarId, data.selected)
  );

export const setDestinationCalendar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(calendarSchema)
  .handler(async ({ context, data }) =>
    (await requireService()).setDestination(context.userId, data.credentialId, data.calendarId)
  );

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ credentialId: z.number().int().positive() }))
  .handler(async ({ context, data }) =>
    (await requireService()).disconnect(context.userId, data.credentialId)
  );
