---
title: Real Databases and Fakes over Mocks
impact: MEDIUM
impactDescription: Tests that use real SQLite and protocol fakes catch real bugs
tags: testing, mocking, fakes, vitest
---

# Real Databases and Fakes over Mocks

**Impact: MEDIUM**

## Use a real database

Unit tests run against a real, fully migrated SQLite database from `createTestDb()`
(`apps/web/src/test/testDb.ts`); each call gets a fresh file that is deleted after the test file.
Don't mock repositories or Drizzle: a mocked query can't catch a wrong column, a missing migration
or a D1 limit.

```typescript
import { createTestDb } from "../../test/testDb";

beforeEach(async () => {
  db = await createTestDb();
  service = new WebhookService(new WebhookRepository(db));
});
```

## Inject what varies

Services take the things tests need to control as constructor dependencies, so no module mocking is
needed:

- `fetchImpl: typeof fetch` for third-party HTTP (`WebhookService`, `googleCalendarProvider`)
- `now?: () => Date` for time (`TeamService`, `BookingActionsService`)
- `runInBackground` for background work
- Interfaces such as `CalendarProvider` / `VideoProvider` for integrations

## Fakes for third parties

Write a small in-memory fake of the provider's API rather than a deep mock:

- `apps/web/src/server/apps/fakeApps.ts` (Microsoft, Zoom, Daily), `calendars/google/fakeGoogle.ts`, `calendars/caldav/fakeCalDav.ts`, `payments/stripe/fakeStripe.ts`
- Unit tests call them through `fetchImpl`; e2e serves the same fakes over HTTP from `apps/web/e2e/support/`

**Incorrect:**

```typescript
vi.mock("./WebhookRepository"); // The test no longer runs any SQL
```

**Correct:**

```typescript
const fetchImpl = vi.fn<typeof fetch>(async () => new Response("ok"));
const service = new WebhookService(new WebhookRepository(db), fetchImpl);
```

## General Guidance

- `vi.fn()` is fine for a single callback (a listener, `fetchImpl`); avoid `vi.mock` of whole modules
- If a class is hard to test without mocks, make the dependency injectable instead
- Keep fakes faithful to the real API's shapes; they are also what e2e runs against
