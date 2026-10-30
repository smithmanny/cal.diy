---
title: Respect Domain Boundaries
impact: CRITICAL
impactDescription: Prevents architectural erosion and maintains loose coupling
tags: architecture, boundaries, imports, coupling
---

## Respect Domain Boundaries

**Impact: CRITICAL**

Domains in `apps/web/src/server/<domain>/` depend on each other through Services and
Repositories passed in by `container.ts`, not by reaching into another domain's tables or
internals. The browser only reaches the server through server functions.

**Rules:**
- A Service gets what it needs from other domains as constructor dependencies (a Repository, another Service, or a callback), wired in its `container.ts`
- A Service never queries another domain's tables directly; it asks that domain's Repository or Service
- Routes and components import server code only from `functions.ts` (server functions) or as `import type`; never a Repository, Service or `container.ts`
- Server-only modules start with `import "@tanstack/react-start/server-only";` so a wrong import from client code fails the build

**Incorrect (reaching into another domain):**

```typescript
// apps/web/src/server/event-types/EventTypeService.ts
import { membership } from "@calcom/db/schema";

// Event types querying the teams domain's Membership table itself
const [row] = await db.select({ role: membership.role }).from(membership).where(...);
```

```tsx
// apps/web/src/components/teams/TeamMembers.tsx
import { getTeamService } from "~/server/teams/container"; // Server-only code in a component
```

**Correct (dependency wired in the container):**

```typescript
// apps/web/src/server/event-types/container.ts
return new EventTypeService({
  eventTypeRepo: new EventTypeRepository(db),
  scheduleRepo: new ScheduleRepository(db),
  hashedLinkRepo: new HashedLinkRepository(db),
  defaultLocation: (userId) => apps.defaultLocation(userId),
  canManageTeam: async (userId, teamId) => canManage(await new TeamRepository(db).findRole(teamId, userId)),
});
```

```tsx
// apps/web/src/components/teams/TeamMembers.tsx
import type { getTeam } from "~/server/teams/functions";
import { removeTeamMember, updateTeamMemberRole } from "~/server/teams/functions";
```

**Shared code placement:**
- Browser-safe helpers used by client and server: `apps/web/src/lib/`
- Code shared with other workspaces (schema, slots engine, UI): `packages/*` (see `architecture-circular-dependencies`)

**Benefits:**
- Looking for booking logic? It's in `apps/web/src/server/bookings/`
- Each domain can be tested on its own with its dependencies passed in
- Dependencies between domains are visible in one place, the container

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
