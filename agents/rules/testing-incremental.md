---
title: Incremental Test Fixing
impact: MEDIUM
impactDescription: Fixing one file at a time keeps failures understandable
tags: testing, debugging, workflow
---

# Incremental Test Fixing

## One File at a Time

When fixing failing tests, address one file at a time rather than everything at once. It makes
each failure easier to understand and fix.

## Recommended Order

1. `yarn type-check` to find TypeScript errors
2. `yarn test` to find failing unit tests
3. Fix type errors first; they are often the cause of the test failures
4. Then fix and re-run one test file at a time:

```bash
TZ=UTC yarn workspace @calcom/web vitest run src/server/bookings/BookingService.test.ts
TZ=UTC yarn workspace @calcom/web vitest run src/server/bookings/BookingService.test.ts -t "round robin"
```

5. Run the full `yarn test` again before you finish

## Focus Strategy

- Get each file passing completely before moving to the next
- If a test fails on a missing column or table, check that a migration exists for the schema change (`yarn db:generate`): unit tests build their databases from `packages/db/migrations`
- For e2e failures, run the single spec (`yarn e2e booking.spec.ts`) and open the trace in `apps/web/test-results`
