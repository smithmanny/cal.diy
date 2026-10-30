import "@tanstack/react-start/server-only";

import process from "node:process";
import type { Database } from "@calcom/db/database";
import { CredentialRepository } from "../apps/CredentialRepository";
import { CredentialVault } from "../apps/CredentialVault";
import { encryptionKey, publicUrl } from "../apps/config";
import { appEndpoints } from "../apps/endpoints";
import { getDb } from "../db";
import { PaymentRepository } from "./PaymentRepository";
import { PaymentService } from "./PaymentService";
import { StripeClient } from "./stripe/StripeClient";

/** Cal's variables: the platform's secret key, its Connect client id, and the webhook's signing secret. */
function stripeSettings() {
  const { STRIPE_PRIVATE_KEY, STRIPE_CLIENT_ID, STRIPE_WEBHOOK_SECRET } = process.env;
  const key = encryptionKey();
  if (!STRIPE_PRIVATE_KEY || !STRIPE_CLIENT_ID || !STRIPE_WEBHOOK_SECRET || !key) return null;
  return {
    secretKey: STRIPE_PRIVATE_KEY,
    clientId: STRIPE_CLIENT_ID,
    webhookSecret: STRIPE_WEBHOOK_SECRET,
    key,
  };
}

export function createStripeClient(): StripeClient | null {
  const settings = stripeSettings();
  if (!settings) return null;
  const endpoints = appEndpoints();
  return new StripeClient({
    secretKey: settings.secretKey,
    clientId: settings.clientId,
    apiUrl: endpoints.stripeApi,
    connectUrl: endpoints.stripeConnect,
  });
}

/** Null when Stripe isn't configured; paid events then can't be booked. */
export function createPaymentService(db: Database): PaymentService | null {
  const settings = stripeSettings();
  const stripe = createStripeClient();
  if (!settings || !stripe) return null;
  return new PaymentService({
    repo: new PaymentRepository(db),
    credentials: new CredentialRepository(db),
    vault: new CredentialVault(settings.key),
    stripe,
    webhookSecret: settings.webhookSecret,
    publicUrl: publicUrl(),
    // Imported when needed: the booking service also depends on this one.
    markBookingPaid: async (bookingUid, status) => {
      const { getBookingService } = await import("../bookings/container");
      await (await getBookingService()).markPaid(bookingUid, status);
    },
  });
}

export async function getPaymentService(): Promise<PaymentService | null> {
  return createPaymentService(await getDb());
}
