import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { WebhookRepository } from "../webhooks/WebhookRepository";
import { createWebhookListener } from "../webhooks/webhookListener";
import type { BusyTimesProvider } from "./BookingService";
import type { BookingListener } from "./events";

export function getBookingListeners(db: Database): BookingListener[] {
  return [createWebhookListener(new WebhookRepository(db))];
}

// External calendars register here as they are ported.
export function getBusyTimesProviders(_db: Database): BusyTimesProvider[] {
  return [];
}
