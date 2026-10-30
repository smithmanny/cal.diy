import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppError } from "../errors";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getPushService } from "./container";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

async function requireService() {
  const service = await getPushService();
  if (!service) throw new AppError("not_found", 404);
  return service;
}

/** The VAPID key browsers subscribe with, or null when push isn't set up on this instance. */
export const getPushConfig = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => ({ publicKey: (await getPushService())?.publicKey ?? null }));

export const subscribeToPush = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(subscriptionSchema)
  .handler(async ({ context, data }) => (await requireService()).subscribe(context.userId, data));

export const unsubscribeFromPush = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ endpoint: z.string().url().max(2000) }))
  .handler(async ({ context, data }) => (await requireService()).unsubscribe(context.userId, data.endpoint));
