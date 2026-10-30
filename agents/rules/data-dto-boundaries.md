---
title: Use DTOs at Every Architectural Boundary
impact: CRITICAL
impactDescription: Prevents technology coupling and security risks
tags: data, dto, boundaries, security, types, zod
---

## Use DTOs at Every Architectural Boundary

**Impact: CRITICAL**

Database rows must not leak to the browser or to API clients. Services map rows to DTOs, and the
public API maps DTOs to Cal's API shapes.

**Problems with leaking rows:**
- Secret columns reach the client (`webhook.secret`, `credential.key`)
- Components get coupled to the database schema
- The schema can't change without breaking the UI or the public API

**Incorrect (row returned as is):**

```typescript
// apps/web/src/server/webhooks/functions.ts
import type { Webhook } from "@calcom/db/schema";

export const getWebhook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<Webhook> => {
    const db = await getDb();
    const [row] = await db.select().from(webhook).where(eq(webhook.id, data.id));
    return row; // Includes `secret`
  });
```

**Correct (DTO built in the service):**

```typescript
// apps/web/src/server/webhooks/types.ts
export type WebhookDto = {
  id: string;
  subscriberUrl: string;
  eventTriggers: SupportedTrigger[];
  active: boolean;
  hasSecret: boolean;
  payloadTemplate: string | null;
};

// apps/web/src/server/webhooks/WebhookService.ts
function toDto(row: WebhookRow): WebhookDto {
  // The secret is write-only: it signs payloads and is never sent back to the browser.
  return {
    id: row.id,
    subscriberUrl: row.subscriberUrl,
    eventTriggers: triggers,
    active: row.active,
    hasSecret: Boolean(row.secret),
    payloadTemplate: row.payloadTemplate,
  };
}
```

**The standard:**
1. **Data layer to app**: repositories return selected columns; services map them to DTOs declared in the domain's `types.ts` (e.g. `WebhookDto` in `apps/web/src/server/webhooks/types.ts`)
2. **App to public API**: API v2 mappers in `apps/web/src/server/api-v2/*Mapper.ts` turn DTOs into Cal's response shapes (`toWebhookOutput`, `toMeOutput`) and validate input with Zod (`createWebhookInputSchema`)
3. **Input**: every server function has `.validator(zodSchema)`; every API route parses with `parseBody` / `parseQuery`
4. **Components** type their props from server function results (`Awaited<ReturnType<typeof getTeam>>`), never from `@calcom/db/schema` row types

### Naming

- `{Entity}Dto` for what a service returns (`WebhookDto`)
- `{Entity}Input` for validated input (`WebhookInput = z.infer<typeof webhookInputSchema>`)
- `to{Entity}Output` for API v2 response mappers

### Enums

`@calcom/db/enums` exports plain string-literal unions (`BookingStatus`, `MembershipRole`), so
DTOs can use them without coupling to Drizzle.

**Type safety**: never use `as any` in a mapper. If types don't line up, fix the mapping.

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
