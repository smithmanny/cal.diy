---
title: Use Constructor Injection, Wired in container.ts
impact: HIGH
impactDescription: Enables testability and keeps wiring in one place
tags: patterns, dependency-injection, di, container, testing, coupling
---

## Use Constructor Injection, Wired in container.ts

**Impact: HIGH**

Services and repositories receive their dependencies through the constructor. Each domain's
`container.ts` builds them with plain functions. There is no DI library: the container is ordinary
TypeScript, so a missing dependency is a type error.

**Incorrect (dependencies created inside the class):**

```typescript
export class TeamService {
  private teamRepo = new TeamRepository(getDbSync()); // Hidden dependency, hard to test

  async get(userId: number, teamId: number) {
    const role = await this.teamRepo.findRole(teamId, userId);
    ...
  }
}
```

**Correct (dependencies passed in):**

```typescript
// apps/web/src/server/teams/TeamService.ts
type Deps = { teamRepo: TeamRepository; now?: () => Date };

export class TeamService {
  constructor(private readonly deps: Deps) {}
}

// apps/web/src/server/teams/container.ts
import "@tanstack/react-start/server-only";
import { getDb } from "../db";
import { TeamRepository } from "./TeamRepository";
import { TeamService } from "./TeamService";

export async function getTeamService(): Promise<TeamService> {
  return new TeamService({ teamRepo: new TeamRepository(await getDb()) });
}
```

### Conventions

- **One dependency**: pass it directly (`new WebhookService(new WebhookRepository(db))`, `new TeamRepository(db)`)
- **Several**: a `Deps` object type, read through `this.deps` (`BookingService`, `TeamService`, `PaymentService`)
- **Repositories** take the `Database` from `@calcom/db/database`
- **Container functions**:
  - `getXService(): Promise<XService>` gets the database with `getDb()` and builds the service; server functions and routes call this
  - `createXService(db: Database)` builds it from a database you already have, so other containers can compose it (`createAppsService(db)`, `createCalendarService(db)`)
  - Return `null` when an optional integration isn't configured (`createPaymentService` without Stripe settings, `createCalendarService` without `CALENDSO_ENCRYPTION_KEY`); callers skip the feature
- **Things that vary in tests** are dependencies too: `now?: () => Date`, `fetchImpl: typeof fetch = fetch`, `runInBackground`
- **Lazy imports** break container cycles (`payments/container.ts` imports `../bookings/container` inside a callback)
- Call container functions inside server function handlers, so the server-only container stays out of the client bundle:

```typescript
// apps/web/src/server/bookings/functions.ts
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getBookingActionsService, getBookingService } from "./container";

export const getPublicProfile = createServerFn({ method: "GET" })
  .validator(usernameSchema)
  .handler(async ({ data }) => (await getBookingService()).getProfile(data.username));
```

### In tests

Build the class directly with a real test database and fakes; don't go through the container.

```typescript
// apps/web/src/server/webhooks/WebhookService.test.ts
beforeEach(async () => {
  db = await createTestDb();
  repo = new WebhookRepository(db);
  service = new WebhookService(repo);
});
```

## Common Mistakes

**Static methods** bypass injection:

```typescript
// Bad
export class WebhookRepository {
  static async findById(id: string) { ... }
}

// Good
export class WebhookRepository {
  constructor(private readonly db: Database) {}
  async findById(id: string) { ... }
}
```

**Building a service by hand in a server function or route** duplicates the wiring and drifts
from the container:

```typescript
// Bad
.handler(async ({ data }) => new TeamService({ teamRepo: new TeamRepository(await getDb()) }).get(...))

// Good
.handler(async ({ context, data }) => (await getTeamService()).get(context.userId, data.teamId))
```

**Calling `getDb()` inside a service or repository** hides the dependency. Only containers (and
the runtime) call `getDb()`.

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
