---
paths:
  - "apps/web/e2e/**"
  - "apps/web/playwright.config.ts"
title: Playwright E2E Testing
impact: HIGH
impactDescription: E2E tests catch integration issues before production
tags: testing, playwright, e2e
---

# Playwright E2E Testing

**Impact: HIGH**

Browser tests live in `apps/web/e2e/*.spec.ts`. By default Playwright starts `vite dev` on a
throwaway SQLite file (`apps/web/data/e2e-<timestamp>.db`) and global setup starts fake Google,
Microsoft, Zoom, Daily, CalDAV, Stripe, Resend and push servers plus a webhook receiver
(`apps/web/e2e/support/global-setup.ts`).

## Running Tests

```bash
# Once: install the browser
yarn workspace @calcom/web playwright install chromium

yarn e2e                                   # whole suite
yarn e2e webhooks.spec.ts                  # one spec
yarn e2e booking.spec.ts --grep "reschedule"

# Against a running production build (Node with TRUST_PROXY=loopback, a Workers preview, Docker)
E2E_BASE_URL=http://localhost:3000 yarn e2e
```

Running the full suite takes a while; ask before running it (see `CLAUDE.md`, "Ask first"), and run
the specs your change touches.

## Writing Specs

- Import `test` and `expect` from `./support/test`, not from `@playwright/test`: each context gets its own client IP so per-IP sign-in rate limits don't trip
- Use the helpers in `./support/helpers` (`signUp`, `completeOnboarding`, `bookFirstSlot`, `linkFromLatestEmail`, `codeFromLatestEmail`) and unique names (`uniqueName`) so specs don't depend on each other
- A second person (the booker) is a separate context: `await (await newClientContext(browser)).newPage()`
- States the UI can't reach go through `./support/db` (`moveBookingToPast`, `makeAdmin`), which only works on the default dev-server run
- Specs that need the fakes skip themselves against `E2E_BASE_URL`: `test.skip(!hasFakes, "needs the local webhook receiver")`
- Select by role and visible text (`getByRole("button", { name: "Save" })`), which also checks the translation renders
- The suite runs with one worker because SQLite has one writer; don't rely on parallelism

## Local First

Make sure the specs you touched pass locally before pushing. Never push test code that hasn't
passed locally.

## CI Behavior

The "Browser tests (Node + SQLite)" job in `.github/workflows/ci.yml` runs `yarn e2e` on every pull
request. On failure, traces are uploaded as the `playwright-traces` artifact (from
`apps/web/test-results`); open them with `npx playwright show-trace <trace.zip>`.
