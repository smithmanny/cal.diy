---
title: Isolate Data Access Behind Repositories
impact: CRITICAL
impactDescription: Keeps Drizzle and SQL details out of business logic
tags: data, repository, drizzle, orm, isolation
---

## Isolate Data Access Behind Repositories

**Impact: CRITICAL**

All database access goes through Repository classes. A Repository takes the driver-agnostic
`Database` (`@calcom/db/database`, the same type on D1 and libSQL) in its constructor, owns the
Drizzle queries for its tables, and returns plain rows. Services never import `drizzle-orm`,
`@calcom/db/schema` or `getDb`.

This is what let the migration swap Prisma for Drizzle without rewriting the services: only the
repositories changed.

**Incorrect (Drizzle in a service):**

```typescript
// apps/web/src/server/webhooks/WebhookService.ts
import { webhook } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../db";

export class WebhookService {
  async list(userId: number) {
    const db = await getDb();
    return db.select().from(webhook).where(eq(webhook.userId, userId));
  }
}
```

**Correct (repository injected into the service):**

```typescript
// apps/web/src/server/webhooks/WebhookRepository.ts
import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { webhook } from "@calcom/db/schema";
import { asc, eq } from "drizzle-orm";

export class WebhookRepository {
  constructor(private readonly db: Database) {}

  findManyByUserId(userId: number) {
    return this.db.select(columns).from(webhook).where(eq(webhook.userId, userId)).orderBy(asc(webhook.createdAt));
  }
}

// apps/web/src/server/webhooks/WebhookService.ts
export class WebhookService {
  constructor(private readonly repo: WebhookRepository) {}

  async list(userId: number): Promise<WebhookDto[]> {
    return (await this.repo.findManyByUserId(userId)).map(toDto);
  }
}

// apps/web/src/server/webhooks/container.ts
export async function getWebhookService(): Promise<WebhookService> {
  return new WebhookService(new WebhookRepository(await getDb()));
}
```

**The standard:**
- Repositories are the only code that imports `drizzle-orm` and table objects from `@calcom/db/schema` (plus tests and `e2e/support/db.ts`, which set up data)
- Repositories receive `Database` through the constructor; services receive repositories through theirs (see `patterns-dependency-injection`)
- No business logic in repositories: no permission checks, no `AppError`s for business rules, no emails
- D1 rules apply inside repositories: `db.batch` instead of transactions, `chunkRowsForInsert`, `conditionalInsert` (see `data-drizzle-migrations`)

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
