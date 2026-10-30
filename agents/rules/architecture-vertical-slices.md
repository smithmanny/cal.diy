---
title: Organize Code by Domain Using Vertical Slices
impact: CRITICAL
impactDescription: Dramatically improves discoverability and reduces cross-team conflicts
tags: architecture, vertical-slices, ddd, organization
---

## Organize Code by Domain Using Vertical Slices

**Impact: CRITICAL**

Server code is organized by domain, not by technical layer. Each folder in
`apps/web/src/server/` is a vertical slice for one domain (`bookings`, `event-types`, `schedules`,
`teams`, `webhooks`, `payments`, `apps`, `calendars`, ...), holding that domain's data access,
business logic, wiring and transport entry points.

**Incorrect (layered architecture):**

```
apps/web/src/server/
  repositories/
    BookingRepository.ts
    WebhookRepository.ts
  services/
    BookingService.ts
    WebhookService.ts
  functions/
    bookings.ts
    webhooks.ts
```

Changing one feature means touching files spread across several folders, and it's hard to see
what a feature does.

**Correct (vertical slices, as the code is today):**

```
apps/web/src/server/webhooks/
  WebhookRepository.ts     # Drizzle queries for the Webhook table
  WebhookService.ts        # Business rules (ownership, duplicate URLs, DTOs)
  WebhookService.test.ts   # Tests against a real SQLite database
  container.ts             # getWebhookService(): wires the repository into the service
  functions.ts             # createServerFn entry points for the settings pages
  types.ts                 # Zod input schemas and DTO types
  payload.ts               # Domain helpers (Cal-compatible payloads, signing)
  webhookListener.ts       # Reacts to booking events
```

A slice usually contains:
- `<Entity>Repository.ts`: data access with Drizzle, no business logic
- `<Entity>Service.ts`: business rules and use cases
- `container.ts`: builds services with their dependencies
- `functions.ts`: server functions for the app's pages
- `types.ts`: input schemas and DTOs
- `*.test.ts`: unit tests next to the code they test

Code that crosses slices lives elsewhere:
- Pages and API routes: `apps/web/src/routes/` (API v2 adapters in `apps/web/src/server/api-v2/`)
- React components: `apps/web/src/components/<domain>/`
- Browser-safe helpers shared by client and server: `apps/web/src/lib/`
- Runtime-specific code (D1 vs libSQL, background work, SMTP): `apps/web/src/server/runtime/`

**Benefits:**
- Everything about a domain is in one folder
- You can understand a feature by reading one directory
- Changes to different domains rarely conflict

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
