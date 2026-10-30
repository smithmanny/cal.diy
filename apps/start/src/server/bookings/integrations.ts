import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { createCalendarService } from "../calendars/container";
import { createEmailService } from "../emails/container";
import { createPaymentService } from "../payments/container";
import { createPushService } from "../push/container";
import { createVideoService } from "../video/container";
import { WebhookRepository } from "../webhooks/WebhookRepository";
import { createWebhookListener } from "../webhooks/webhookListener";
import { createAuditListener } from "./auditListener";
import { BookingAuditRepository } from "./BookingAuditRepository";
import type { BusyTimesProvider } from "./BookingService";
import type { BookingListener } from "./events";

/**
 * Run in this order: the meeting first, then calendar sync (which may add a Meet link), so the
 * calendar event, webhooks and emails all see the join link.
 */
export function getBookingListeners(db: Database): BookingListener[] {
  const video = createVideoService(db);
  const calendars = createCalendarService(db);
  const emails = createEmailService();
  const payments = createPaymentService(db);
  const listeners: BookingListener[] = [];
  if (video) listeners.push((event) => video.onBookingEvent(event));
  if (calendars) listeners.push((event) => calendars.onBookingEvent(event));
  // Refunds on cancel and rejection, and moving what was paid to a rescheduled booking.
  if (payments) listeners.push((event) => payments.onBookingEvent(event));
  listeners.push(createWebhookListener(new WebhookRepository(db)));
  listeners.push(createAuditListener(new BookingAuditRepository(db)));
  if (emails) listeners.push((event) => emails.onBookingEvent(event));
  const push = createPushService(db);
  if (push) listeners.push((event) => push.onBookingEvent(event));
  return listeners;
}

export function getBusyTimesProviders(db: Database): BusyTimesProvider[] {
  const calendars = createCalendarService(db);
  return calendars ? [({ userId, from, to }) => calendars.busyTimes(userId, from, to)] : [];
}
