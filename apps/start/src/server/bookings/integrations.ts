import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { createCalendarService } from "../calendars/container";
import { WebhookRepository } from "../webhooks/WebhookRepository";
import { createWebhookListener } from "../webhooks/webhookListener";
import type { BusyTimesProvider } from "./BookingService";
import type { BookingListener } from "./events";

/** Run in this order: calendar sync first, so webhooks and emails see the Meet link it creates. */
export function getBookingListeners(db: Database): BookingListener[] {
  const calendars = createCalendarService(db);
  return [
    ...(calendars ? [(event: Parameters<BookingListener>[0]) => calendars.onBookingEvent(event)] : []),
    createWebhookListener(new WebhookRepository(db)),
  ];
}

export function getBusyTimesProviders(db: Database): BusyTimesProvider[] {
  const calendars = createCalendarService(db);
  return calendars ? [({ userId, from, to }) => calendars.busyTimes(userId, from, to)] : [];
}
