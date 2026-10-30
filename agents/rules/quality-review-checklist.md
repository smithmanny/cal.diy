---
title: Code Review Checklist
impact: HIGH
impactDescription: Ensures consistent code quality across all reviews
tags: quality, code-review, checklist
---

## Code Review Checklist

**Impact: HIGH**

A checklist for reviewers to keep quality consistent.

### File Naming Conventions

- **Repository files**: `<Entity>Repository.ts`, PascalCase, matching the exported class (`WebhookRepository.ts`). No technology prefix: Drizzle is the only data layer
- **Service files**: `<Entity>Service.ts`, matching the exported class, specific rather than generic (`BookingActionsService.ts`)
- **Wiring and entry points**: `container.ts` and `functions.ts` in each domain folder
- **Route files** follow TanStack Router's file conventions (`$param.tsx`, `_authed/...`, `index.tsx`)
- **New files**: no dot-suffixes like `.service.ts` or `.repository.ts`; `.test.ts` and `.spec.ts` are reserved for tests

### Code Quality

- Prefer early returns to keep nesting shallow and null checks up front
- Prefer composition (React `children`) over prop drilling
- Drizzle queries:
  - Select only the columns you need: `db.select({ id: booking.id, ... })`, never a bare `db.select()` on tables with secrets
  - Never return `credential.key` / `encryptedKey` from a server function or API route
  - Atomic writes use `db.batch([...])`; there are no interactive transactions on D1
  - Multi-row inserts go through `chunkRowsForInsert` (100 bound parameters per statement on D1)
- Data access stays in repositories; business logic stays in services
- Server functions that touch private data have `authMiddleware` or `adminMiddleware` and validate input with Zod
- Expected failures throw `AppError` with a translation key
- All UI text goes through `t()` (`useT()` from `~/lib/i18n`); new keys are added to `packages/i18n/locales/en/common.json` above `ADD_NEW_STRINGS_ABOVE_THIS_LINE_TO_PREVENT_MERGE_CONFLICTS` and to the route's `MESSAGE_KEYS`
- No `as any`; use `import type` for types
- Look for O(n²) logic in backend code; aim for O(n log n) or O(n)
- No new circular imports between containers or packages
- Flag heavy Day.js use in hot paths (`.add`, `.diff`, `.isBefore`, `.isAfter` in loops, especially in time-zone mode); prefer native `Date` and `.getTime()` comparisons
- Runtime-specific code goes behind `#runtime`, and production checks use `IS_PRODUCTION_BUILD`
- Comments explain why, not what

### API Documentation

`docs/api-reference/v2/openapi.json` is Cal's API v2 spec; this app serves the subset listed in
`MIGRATION.md` (API v2). When it is edited:
- "summary" fields are short and concise
- "summary" fields do not end with a period
- "summary" fields are written in proper American English

### API Changes

API v2 (`apps/web/src/routes/api/v2/`) keeps Cal's paths and shapes. Changes must not break existing
endpoints: a new shape needs a new `cal-api-version`, and the old one keeps working.

### PR Size

For large pull requests (>500 lines changed or >10 code files), advise splitting:
- By feature boundary: separate features or user stories
- By layer: schema and migration, server (repository, service, server functions), UI, tests
- By dependency chain: PRs that can be merged in order
- Suggested order: migration → server logic → UI → e2e specs
