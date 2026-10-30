---
title: Import and Export Patterns
impact: MEDIUM
impactDescription: Incorrect imports cause build failures, bundle bloat and server code in the client
tags: imports, exports, modules, aliases, server-only
---

# Import and Export Patterns

**Impact: MEDIUM**

## Type imports

Use `import type` (or inline `type`) for anything used only as a type. It keeps server modules out
of the client bundle when a component only needs a server function's return type.

```typescript
// Good
import type { Database } from "@calcom/db/database";
import type { getTeam } from "~/server/teams/functions";
import { type getHolidaySettings, setHolidayCountry } from "~/server/holidays/functions";

// Bad
import { Database } from "@calcom/db/database";
```

## Named exports

Use named exports. The exception is what a framework needs by name (`export const Route` in route
files). Check the real export before importing:

```typescript
// Good
import { WebhookService } from "./WebhookService";
import { Button } from "@coss/ui/components/button";

// Bad - assumes a default export that doesn't exist
import WebhookService from "./WebhookService";
```

## Paths and aliases

| Import | Use |
| --- | --- |
| `~/...` | `apps/web/src/...`, from routes, components and lib (`~/server/teams/functions`, `~/lib/i18n`) |
| `./...`, `../...` | Inside `apps/web/src/server/`, between files of a domain and neighboring domains |
| `#runtime` | Runtime-specific code; resolves to `server/runtime/cloudflare.ts` or `node.ts` at build time |
| `@calcom/db/<entry>` | Only the entries in `packages/db/package.json` `exports` (`schema`, `enums`, `database`, `ids`, ...) |
| `@coss/ui/components/<name>` | One UI component per import, never a barrel |

## Server-only modules

Repositories, services and containers start with:

```typescript
import "@tanstack/react-start/server-only";
```

Server function files (`functions.ts`) can be imported by the client, so they import their
container but only call it inside handlers:

```typescript
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getTeamService } from "./container";
```

## Factory naming

Container functions are named for what they return:

```typescript
// Good
export async function getWebhookService(): Promise<WebhookService> { ... }
export function createPaymentService(db: Database): PaymentService | null { ... }

// Bad - looks like a class
export function WebhookService() { ... }
```

## Generated files

Never edit `apps/web/src/routeTree.gen.ts`; TanStack Router regenerates it when `yarn dev` runs.
