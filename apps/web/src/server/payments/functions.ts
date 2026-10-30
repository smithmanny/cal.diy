import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppError } from "../errors";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getPaymentService } from "./container";

// Public: the booker isn't signed in. The payment uid is a random UUID only they were sent to.
const paymentUidSchema = z.object({ uid: z.string().uuid() });

async function requireService() {
  const service = await getPaymentService();
  if (!service) throw new AppError("not_found", 404);
  return service;
}

export const getPaymentPage = createServerFn({ method: "GET" })
  .validator(paymentUidSchema.extend({ returnedFromCheckout: z.boolean().default(false) }))
  .handler(async ({ data }) => (await requireService()).paymentPage(data.uid, data.returnedFromCheckout));

export const startCheckout = createServerFn({ method: "POST" })
  .validator(paymentUidSchema)
  .handler(async ({ data }) => ({ url: await (await requireService()).checkoutUrl(data.uid) }));
