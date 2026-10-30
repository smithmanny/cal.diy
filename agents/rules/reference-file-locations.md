---
title: Key File Locations
impact: LOW
tags: reference, files, paths
---

# Key File Locations

## Pages (TanStack Router file routes, `apps/web/src/routes/`)

- Root route and request context: `routes/__root.tsx` (session from `server/auth/session.ts`)
- Signed-in area: `routes/_authed.tsx` (sign-in redirect in `beforeLoad`) and `routes/_authed/**`
- Event types: `routes/_authed/event-types/index.tsx`, `$eventTypeId.tsx` (editors in `components/event-types/`)
- Bookings list: `routes/_authed/bookings/$status.tsx` (components in `components/bookings/`)
- Availability: `routes/_authed/availability/`
- Teams: `routes/_authed/teams/` (components in `components/teams/`)
- Settings: `routes/_authed/settings/` (admin pages in `settings/admin/`, API keys and webhooks in `settings/developer/`)
- Public booking pages: `routes/$username/`, `routes/team/$slug/`, `routes/d/` (private links), `routes/booking/$uid.tsx`
- Auth pages: `routes/auth/`
- Generated route tree: `src/routeTree.gen.ts` (never edit)

## Server (`apps/web/src/server/`)

- Domains: `server/<domain>/` with `*Repository.ts`, `*Service.ts`, `container.ts`, `functions.ts`, `types.ts`
- Errors: `server/errors.ts` (`AppError`), `server/errorMiddleware.ts`
- Server function middleware: `server/middleware.ts` (`authMiddleware`, `optionalUserId`), `server/admin/middleware.ts` (`adminMiddleware`)
- Database handle: `server/db.ts` (`getDb`, from `#runtime`)
- Runtime differences (Workers vs Node): `server/runtime/cloudflare.ts`, `server/runtime/node.ts`
- Auth: `server/auth/createAuth.ts` (Better Auth with admin, two-factor, API key and organization plugins), `server/auth/organizations.ts` (teams), `server/auth/session.ts`
- Booking side effects: `server/bookings/integrations.ts` (listeners), `server/bookings/events.ts`
- Translations on the server: `server/catalog.ts`, `server/i18n.ts`

## Public API v2

- Routes: `apps/web/src/routes/api/v2/`
- Shared plumbing (auth, envelope, errors, parsing): `apps/web/src/server/api-v2/http.ts`, `auth.ts`
- Mappers between Cal's API shapes and the services: `apps/web/src/server/api-v2/*Mapper.ts`
- Cal's OpenAPI spec (the app serves the subset in `MIGRATION.md`): `docs/api-reference/v2/openapi.json`

## Other server routes

- Better Auth: `routes/api/auth/$.ts`; OAuth provider: `routes/api/auth/oauth/`
- App installs: `routes/api/integrations/$app/add.ts`, `callback.ts`; Stripe webhook: `routes/api/integrations/stripepayment/webhook.ts`
- Health check: `routes/api/health.ts`

## Apps and integrations

- App catalog: `apps/web/src/lib/apps.ts`; logos in `apps/web/public/app-store/`
- Calendars: `server/calendars/` (`google/`, `office365/`, `caldav/`); video: `server/video/`; Stripe: `server/payments/stripe/`

## Database

- Schema: `packages/db/src/schema.ts` (relations in `relations.ts`, enums in `enums.ts`)
- Migrations: `packages/db/migrations/` (with `meta/`)
- Drivers: `packages/db/src/drivers/d1.ts`, `libsql.ts`
- D1 helpers: `packages/db/src/conditional-insert.ts`, `insert-chunks.ts`, `ids.ts`

## Slots engine

- `packages/scheduling/src/` (`date-ranges.ts`, `slots.ts`, `available-slots.ts`, `limits.ts`, `recurring.ts`, `out-of-office.ts`)

## UI components

- Shared primitives: `packages/coss-ui/src/components/` (import as `@coss/ui/components/<name>`)
- App components: `apps/web/src/components/`

## Translations

- English: `packages/i18n/locales/en/common.json` (add new keys above `ADD_NEW_STRINGS_ABOVE_THIS_LINE_TO_PREVENT_MERGE_CONFLICTS`)

## Tests

- Unit test database: `apps/web/src/test/testDb.ts`
- E2E specs: `apps/web/e2e/*.spec.ts`; helpers and fakes: `apps/web/e2e/support/`
- Playwright config: `apps/web/playwright.config.ts`

## Configuration

- Env examples: `apps/web/.env.example` (Node/Docker), `apps/web/.dev.vars.example` (Workers)
- Cloudflare: `apps/web/wrangler.jsonc`; Vite: `apps/web/vite.config.ts`
- Biome: `biome.json`; CI: `.github/workflows/ci.yml`

## File Naming Conventions

- **Repository files**: `WebhookRepository.ts` (PascalCase with `Repository` suffix)
- **Service files**: `WebhookService.ts` (PascalCase with `Service` suffix)
- **Components**: `TeamMembers.tsx` (PascalCase)
- **Utilities**: `date-utils.ts` (kebab-case)
- **Tests**: same name as the source file + `.test.ts`; e2e specs are `<feature>.spec.ts`
