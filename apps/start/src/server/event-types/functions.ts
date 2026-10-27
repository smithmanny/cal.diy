import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getEventTypeService } from "./container";
import { eventTypeInputSchema, newEventTypeSchema } from "./types";

const idSchema = z.object({ id: z.number().int().positive() });

export const listEventTypes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getEventTypeService()).list(context.userId));

export const getEventType = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) =>
    (await getEventTypeService()).get(context.userId, data.id, context.userTimeZone)
  );

export const createEventType = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(newEventTypeSchema)
  .handler(async ({ context, data }) => (await getEventTypeService()).create(context.userId, data));

export const updateEventType = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema.extend({ eventType: eventTypeInputSchema }))
  .handler(async ({ context, data }) =>
    (await getEventTypeService()).update(context.userId, data.id, data.eventType, context.userTimeZone)
  );

export const setEventTypeHidden = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema.extend({ hidden: z.boolean() }))
  .handler(async ({ context, data }) =>
    (await getEventTypeService()).setHidden(context.userId, data.id, data.hidden)
  );

export const deleteEventType = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => (await getEventTypeService()).delete(context.userId, data.id));
