---
title: What Goes in packages/* vs apps/web
impact: HIGH
impactDescription: Wrong placement causes tight coupling and import issues
tags: architecture, packages, workspaces
---

## What Goes in packages/* vs apps/web

**Impact: HIGH**

Almost all code lives in `apps/web`. The workspaces in `packages/` hold only code that is
independent of the app and shared or tested on its own.

| Workspace | What belongs there |
| --- | --- |
| `packages/db` (`@calcom/db`) | Drizzle schema (`src/schema.ts`), relations, enums, id helpers, D1 and libSQL drivers, D1 helpers (`conditional-insert`, `insert-chunks`), migrations |
| `packages/scheduling` (`@calcom/scheduling`) | The slots engine: date ranges, slots, limits, recurring, out of office. Pure functions, no database |
| `packages/coss-ui` (`@coss/ui`) | UI primitives, imported one file at a time: `@coss/ui/components/button` |
| `packages/i18n` | Translations (`locales/<lang>/common.json`) |
| `packages/dayjs`, `packages/lib` | Cal's dayjs setup and a few shared utilities (`slugify`, `isPasswordValid`, holidays) |
| `packages/embeds/embed-core` | The embed snippet, built into `apps/web/public/embed` |

Everything app-specific goes in `apps/web/src/`: repositories, services, server functions, routes,
components, auth, emails, integrations.

**Incorrect:**

```typescript
// packages/lib/bookings/BookingService.ts - app business logic in a shared package
import { getDb } from "../../apps/web/src/server/db";
```

**Correct:**

```typescript
// apps/web/src/server/bookings/BookingService.ts
import type { BookingRepository } from "./BookingRepository";
```

**Rules of thumb:**
- A package must build and test without `apps/web`
- Put code in a package only if it is reused across workspaces or is a self-contained engine (like the slots engine)
- Adding a new package, or changes that affect several packages, needs agreement first (see `CLAUDE.md`, "Ask first")
