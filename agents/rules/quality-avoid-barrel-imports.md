---
title: Avoid Barrel Imports
impact: MEDIUM
impactDescription: Improves tree-shaking and reduces bundle size
tags: imports, performance, bundling
---

## Avoid Barrel Imports

**Impact: MEDIUM (Improves tree-shaking and reduces bundle size)**

Barrel files (an `index.ts` that re-exports many modules) hurt tree-shaking, slow down Vite, and can
drag server-only code into the client bundle. Import directly from the source file.

**Incorrect (importing from barrel files):**

```typescript
import { BookingService, WebhookService } from "~/server";
import { Button, Input } from "@coss/ui";
```

**Correct (importing directly from source):**

```typescript
import { getBookingService } from "~/server/bookings/container";
import { getWebhookService } from "~/server/webhooks/container";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
```

Don't add new `index.ts` re-export files. Route folders may have `index.tsx` route files; those are
routes, not barrels.

Reference: [Cal.diy Engineering Standards](https://cal.com/blog/engineering-in-2026-and-beyond)
