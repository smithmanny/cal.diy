---
title: Background Work with runInBackground
impact: HIGH
impactDescription: Side effects must not slow responses, and must finish on both runtimes
tags: async, background, workers, waitUntil, listeners
---

# Background Work with runInBackground

**Impact: HIGH**

There is no job queue. Work that shouldn't delay the response (emails, webhooks, calendar sync,
push notifications) runs after it, through `runInBackground` from the `#runtime` alias:

- Cloudflare (`apps/web/src/server/runtime/cloudflare.ts`): `waitUntil(...)` keeps the Worker alive until the promise settles
- Node (`runtime/node.ts`): the process outlives the request, so the promise just continues

Both log failures; neither retries.

## Inject it, don't import it in services

`runInBackground` is a dependency like any other, so tests can await the work or run it inline:

```typescript
// apps/web/src/server/bookings/container.ts
import { runInBackground } from "#runtime";

return new BookingService({
  // ...
  listeners: getBookingListeners(db),
  runInBackground,
});
```

## Booking side effects are listeners

`BookingService` publishes a `BookingEvent` (`apps/web/src/server/bookings/events.ts`) and runs the
`BookingListener`s from `bookings/integrations.ts` in order, in the background. One failing listener
doesn't stop the rest. To react to bookings (a new integration, a notification), add a listener there
rather than calling your code from `BookingService`.

```typescript
export function getBookingListeners(db: Database): BookingListener[] {
  const listeners: BookingListener[] = [];
  if (video) listeners.push((event) => video.onBookingEvent(event));
  if (calendars) listeners.push((event) => calendars.onBookingEvent(event));
  listeners.push(createWebhookListener(new WebhookRepository(db)));
  listeners.push(createAuditListener(new BookingAuditRepository(db)));
  if (emails) listeners.push((event) => emails.onBookingEvent(event));
  return listeners;
}
```

## Rules

- **Never fire and forget a bare promise** (`void sendEmail()`): on Workers it is cut off when the response is sent. Use `runInBackground`
- **Keep it short.** Workers have CPU and duration limits per request; background work counts against them
- **Make it safe to lose.** Nothing retries a failed background task, so anything that must happen (marking a booking paid, writing the booking) runs before the response; only notifications and syncs go to the background
- **Order matters**: listeners run in sequence so later ones see earlier results (the video meeting link is created before calendar sync, emails and webhooks)
