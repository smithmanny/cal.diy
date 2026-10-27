import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { createCalendarService } from "../calendars/container";
import { createEmailService } from "../emails/container";
import { WebhookRepository } from "../webhooks/WebhookRepository";
import { createWebhookListener } from "../webhooks/webhookListener";
import { createAuditListener } from "./auditListener";
import { BookingAuditRepository } from "./BookingAuditRepository";
import type { BusyTimesProvider } from "./BookingService";
import type { BookingListener } from "./events";

/** Run in this order: calendar sync first, so webhooks and emails see the Meet link it creates. */
export function getBookingListeners(db: Database): BookingListener[] {
  const calendars = createCalendarService(db);
  const emails = createEmailService();
  const listeners: BookingListener[] = [];
  if (calendars) listeners.push((event) => calendars.onBookingEvent(event));
  listeners.push(createWebhookListener(new WebhookRepository(db)));
  listeners.push(createAuditListener(new BookingAuditRepository(db)));
  if (emails) listeners.push((event) => emails.onBookingEvent(event));
  return listeners;
}

export function getBusyTimesProviders(db: Database): BusyTimesProvider[] {
  const calendars = createCalendarService(db);
  return calendars ? [({ userId, from, to }) => calendars.busyTimes(userId, from, to)] : [];
}
