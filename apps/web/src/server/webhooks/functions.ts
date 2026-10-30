import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getWebhookService } from "./container";
import { webhookInputSchema } from "./types";

const idSchema = z.object({ id: z.string().uuid() });

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getWebhookService()).list(context.userId));

export const getWebhook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => (await getWebhookService()).get(context.userId, data.id));

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(webhookInputSchema)
  .handler(async ({ context, data }) => (await getWebhookService()).create(context.userId, data));

export const updateWebhook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema.extend({ webhook: webhookInputSchema }))
  .handler(async ({ context, data }) =>
    (await getWebhookService()).update(context.userId, data.id, data.webhook)
  );

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => (await getWebhookService()).delete(context.userId, data.id));

export const pingWebhook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      subscriberUrl: webhookInputSchema.shape.subscriberUrl,
      secret: z.string().max(500).optional(),
    })
  )
  .handler(async ({ data }) => (await getWebhookService()).ping(data.subscriberUrl, data.secret || null));
