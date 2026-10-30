---
title: Prevent Circular Dependencies
impact: CRITICAL
impactDescription: Prevents build failures, type errors and confusing import cycles
tags: architecture, dependencies, packages, imports, circular
---

## Prevent Circular Dependencies

**Impact: CRITICAL**

The dependency graph must be acyclic, from low-level workspaces up to the app. Cycles cause
`undefined` imports at module load, type errors, and bundles that pull in far more than they need.

The workspace hierarchy (lowest to highest):

```
packages/db, packages/lib, packages/dayjs, packages/i18n, packages/config, packages/tsconfig
  ↓
packages/scheduling, packages/coss-ui (@coss/ui), packages/embeds/embed-core
  ↓
apps/web (@calcom/web, can depend on every package)
```

### Packages never import the app

No file in `packages/*` imports from `@calcom/web`, `apps/web` or `~/...`. If a package needs
something the app owns, pass it in as an argument.

**Incorrect:**

```typescript
// packages/scheduling/src/slots.ts
import { getBookingService } from "../../../apps/web/src/server/bookings/container";
```

**Correct:**

```typescript
// packages/scheduling stays pure: callers pass busy times in
import type { BusyInterval } from "@calcom/scheduling/available-slots";
```

### Inside apps/web

- `routes/` and `components/` may import `lib/`, and `server/<domain>/functions.ts` (plus `import type` from anywhere in `server/`)
- `lib/` is browser-safe: it never imports server-only modules (it may import types, and server functions, as `lib/messages.ts` imports `getMessages`)
- `server/` domains may depend on each other's Repositories and Services, but two containers must not import each other at module load

When two domains genuinely need each other (bookings call payments, and payments confirm bookings),
break the cycle with a lazy import inside the callback, as `payments/container.ts` does:

```typescript
// apps/web/src/server/payments/container.ts
// Imported when needed: the booking service also depends on this one.
markBookingPaid: async (bookingUid, status) => {
  const { getBookingService } = await import("../bookings/container");
  await (await getBookingService()).markPaid(bookingUid, status);
},
```

### Runtime code

Code that differs between Cloudflare Workers and Node lives only in
`apps/web/src/server/runtime/cloudflare.ts` and `node.ts`, imported through the `#runtime` alias.
Those files must not import domain code, because every domain imports them (through `getDb`).

## Enforcement

- `yarn type-check` and `yarn build:cf` (CI's Workers build) fail on many cycles and on server-only code reaching the client
- Server-only modules import `@tanstack/react-start/server-only`, which turns a client import into a build error
- Reviewers flag new cross-container imports
