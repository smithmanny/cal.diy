import "@tanstack/react-start/server-only";

import type { BookingListener } from "../bookings/events";
import { deliverWebhook, payloadForEvent } from "./payload";
import { SUPPORTED_TRIGGERS, type SupportedTrigger } from "./types";
import type { WebhookRepository } from "./WebhookRepository";

function isSupportedTrigger(type: string): type is SupportedTrigger {
  return (SUPPORTED_TRIGGERS as readonly string[]).includes(type);
}

/** Delivers booking events to the organizer's active webhooks subscribed to that trigger. */
export function createWebhookListener(
  repo: WebhookRepository,
  fetchImpl: typeof fetch = fetch
): BookingListener {
  return async (event) => {
    const trigger = event.type;
    if (!isSupportedTrigger(trigger)) return;
    const subscribers = (await repo.findActiveByUserId(event.booking.organizer.id)).filter((webhook) =>
      (webhook.eventTriggers ?? []).includes(trigger)
    );
    if (!subscribers.length) return;
    const payload = payloadForEvent(event);
    const results = await Promise.allSettled(
      subscribers.map((subscriber) => deliverWebhook(subscriber, event.type, payload, fetchImpl))
    );
    results.forEach((result, index) => {
      const url = subscribers[index].subscriberUrl;
      if (result.status === "rejected")
        console.error(`Webhook ${event.type} to ${url} failed`, result.reason);
      else if (!result.value.ok)
        console.error(`Webhook ${event.type} to ${url} returned ${result.value.status}`);
    });
  };
}
