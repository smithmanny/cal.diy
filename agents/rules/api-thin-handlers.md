---
paths:
  - "apps/web/src/routes/api/**"
  - "apps/web/src/server/**/functions.ts"
title: Keep Route Handlers and Server Functions Thin
impact: HIGH
impactDescription: Keeps business logic independent of the transport
tags: api, server-functions, routes, http, separation-of-concerns
---

## Keep Route Handlers and Server Functions Thin

**Impact: HIGH**

There are two transports into the server: TanStack Start server functions (`createServerFn` in
`apps/web/src/server/<domain>/functions.ts`, called by the app's own pages) and server routes
(`apps/web/src/routes/api/**`, including the public API v2). Both are thin layers that handle only
transport concerns and hand the work to a Service.

**Handler responsibilities (and only these):**
- Authenticate: `authMiddleware` / `adminMiddleware` on server functions, `apiRoute` / `publicApiRoute` on API v2 routes
- Validate input with Zod (`.validator(schema)`, or `parseBody` / `parseQuery` in API v2)
- Get a Service from the domain's `container.ts` and call it
- Map the result to the response shape (API v2 mappers in `apps/web/src/server/api-v2/*Mapper.ts`)

**Handlers should NOT:**
- Query the database or call Drizzle directly
- Contain business rules, permission rules or multi-step workflows
- Decide things a Service should decide (who may cancel, whether a slot is free)

**Incorrect (business logic in the route):**

```typescript
export const Route = createFileRoute("/api/v2/webhooks/")({
  server: {
    handlers: {
      POST: apiRoute(async ({ request, user }) => {
        const body = await request.json();
        const db = await getDb();
        const [clash] = await db.select({ id: webhook.id }).from(webhook)
          .where(and(eq(webhook.userId, user.id), eq(webhook.subscriberUrl, body.subscriberUrl)));
        if (clash) throw new AppError("webhook_subscriber_url_reserved", 409);
        await db.insert(webhook).values({ id: crypto.randomUUID(), userId: user.id, ...body });
        return body;
      }),
    },
  },
});
```

**Correct (thin route, from `routes/api/v2/webhooks/index.ts`):**

```typescript
export const Route = createFileRoute("/api/v2/webhooks/")({
  server: {
    handlers: {
      POST: apiRoute(async ({ request, user }) => {
        const input = await parseBody(request, createWebhookInputSchema);
        const service = await getWebhookService();
        const { id } = await service.create(user.id, applyWebhookInput(null, input));
        return new WithStatus(201, toWebhookOutput(await service.get(user.id, id), user.id));
      }),
    },
  },
});
```

The same service backs the settings page through a server function:

```typescript
export const listTeams = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getTeamService()).list(context.userId, context.userEmail));
```

**The principle:**
How data travels between client and server (server function, REST route) must not shape the core
logic. The webhook service doesn't know whether the settings page or API v2 called it.

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
