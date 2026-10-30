---
title: Timezone Handling in Tests
impact: MEDIUM
impactDescription: Prevents flaky date assertions across machines
tags: testing, timezone, dates
---

# Timezone Handling in Tests

## Always Use TZ=UTC

Unit tests must run with `TZ=UTC`. The root `yarn test` sets it for every workspace, and
`packages/scheduling` sets it in its own `test` script. When you run Vitest directly, set it yourself:

```bash
# All unit tests (sets TZ=UTC)
yarn test

# One workspace or one file
TZ=UTC yarn workspace @calcom/web test
TZ=UTC yarn workspace @calcom/web vitest run src/server/schedules/ScheduleService.test.ts
```

This keeps time-zone handling the same on every machine and in CI.

## Why This Matters

- Tests may pass locally but fail in CI (or the other way round)
- Date/time assertions become unpredictable
- Debugging time-zone issues is slow

## Writing Date Tests

- Build instants explicitly: `new Date("2025-03-30T01:00:00Z")`, not `new Date(2025, 2, 30)`
- Test DST transitions in a real zone (`Europe/London`, `America/New_York`) through the code's own time-zone parameter, not through the machine's zone
- Pass `now` into services (`now?: () => Date`) instead of depending on the current time

## E2E

```bash
yarn e2e
```

The browser uses the machine's time zone unless the spec sets one. Specs that check times pin it on
the context, as `advanced-options.spec.ts` does:

```typescript
const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
```
