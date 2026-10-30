---
title: Never Introduce Breaking API Changes
impact: CRITICAL
impactDescription: Maintains developer trust and prevents integration nightmares
tags: api, stability, versioning, backwards-compatibility
---

## Never Introduce Breaking API Changes

**Impact: CRITICAL**

API v2 (`apps/web/src/routes/api/v2/`) serves Cal's public API on Cal's paths and request/response
shapes, so integrations written against Cal keep working. Once an endpoint is public, its shape must
stay stable.

**Strategies for avoiding breaking changes:**
- Add new response fields as optional; never rename or remove existing ones
- Keep accepting the request fields Cal accepts; reject unknown fields with a 400 rather than silently changing meaning
- Keep Cal's envelope (`{ status: "success", data }`, `pagination` on lists) and error shape (`{ status: "error", timestamp, path, error: { code, message } }`) from `apps/web/src/server/api-v2/http.ts`
- Keep the `cal-api-version` an endpoint requires; a new shape needs a new version, not a changed old one

**Incorrect (breaking change):**

```typescript
// apps/web/src/server/api-v2/bookingMapper.ts
function toBookingOutput(row: ApiBookingRow) {
  return {
    id: row.id,
    startTime: row.startTime.toISOString(), // Renamed from Cal's "start" - BREAKS CLIENTS
  };
}
```

**Correct (non-breaking evolution):**

```typescript
function toBookingOutput(row: ApiBookingRow) {
  return {
    id: row.id,
    start: row.startTime.toISOString(), // Cal's field name, kept for existing clients
    ...(row.iCalUID ? { icsUid: row.iCalUID } : {}), // Added later, and optional
  };
}
```

**When you must make breaking changes:**
- Serve the new shape under a new `cal-api-version` date, and keep the old version working
- Run both versions side by side during the transition
- Document exactly what changed and why in the PR and in `MIGRATION.md` (API v2 section)

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
