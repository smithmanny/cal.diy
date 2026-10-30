# Build, Test & Development Commands

All commands run from the repo root unless noted.

## Development

- `yarn dev` - TanStack Start dev server on http://localhost:3000, Node + a SQLite file (`apps/web/data/cal.db`); migrations run on boot. Reads `apps/web/.env`
- `yarn dev:cf` - The same app in the Cloudflare Workers runtime (Miniflare + local D1). Reads `apps/web/.dev.vars`; run `yarn db:migrate:d1:local` first

## Build and Deploy

- `yarn build` - Production build for Node/Docker (`apps/web/dist`)
- `yarn build:cf` - Production build for Cloudflare Workers
- `yarn start` - Serve the Node build (`node apps/web/server.node.mjs`)
- `yarn deploy:cf` - Build for Workers and `wrangler deploy`
- `docker compose up -d --build` - Build and run the Docker image (see README)

## Lint, Format & Type Check

- `yarn type-check` - `tsc --noEmit` in `@calcom/web`, `@calcom/db` and `@calcom/scheduling`
- `yarn lint` - Biome lint
- `yarn lint:fix` - Biome check with safe fixes and formatting (`biome check --write .`)
- `yarn format` - Biome format only

## Unit Tests (Vitest)

- `yarn test` - All unit tests in `@calcom/web`, `@calcom/db` and `@calcom/scheduling`, with `TZ=UTC`
- `yarn workspace @calcom/web test` - One workspace (also `@calcom/db`, `@calcom/scheduling`)
- `TZ=UTC yarn workspace @calcom/web vitest run src/server/webhooks/WebhookService.test.ts` - One file
- `TZ=UTC yarn workspace @calcom/web vitest run <file> -t "<test name>"` - One test
- `TZ=UTC yarn workspace @calcom/web vitest` - Watch mode
- `yarn workspace @calcom/web vitest run --coverage` - Coverage report

## End-to-End Tests (Playwright)

- `yarn workspace @calcom/web playwright install chromium` - Install the browser once
- `yarn e2e` - Whole suite against a throwaway dev server and database, with fake third-party servers
- `yarn e2e <spec>` - One spec, e.g. `yarn e2e webhooks.spec.ts`
- `yarn e2e <spec> --grep "<test name>"` - One test
- `E2E_BASE_URL=http://localhost:3000 yarn e2e` - Against an already running server (specs that need the fakes skip themselves; `E2E_FAKES=1` runs the webhook spec too)

## Database

- `yarn db:generate` - Write a migration after editing `packages/db/src/schema.ts`
- `yarn db:migrate:d1:local` - Apply migrations to the local D1 database used by `yarn dev:cf`
- `yarn db:migrate:d1:remote` - Apply migrations to the production D1 database
- `yarn workspace @calcom/db db:migrate` - Apply migrations to `DATABASE_URL` with drizzle-kit (Node runs them on boot anyway)
- `yarn workspace @calcom/db db:studio` - Drizzle Studio
- `yarn import:postgres --from <postgres-url> --to file:./data/cal.db` - Import an existing Cal Postgres database (`--sql <file>` writes SQL for D1 instead)
- `sqlite3 apps/web/data/cal.db` - Open the local database

## Other

- `yarn workspace @calcom/web cf-typegen` - `wrangler types`

## Useful Patterns

```bash
# Before pushing
yarn type-check && yarn lint:fix && yarn test

# Reproduce the CI Workers job
yarn build:cf

# Reset the local database
rm apps/web/data/cal.db && yarn dev
```

## Environment Setup

- `cp apps/web/.env.example apps/web/.env` and set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `CALENDSO_ENCRYPTION_KEY` (`openssl rand -base64 24`)
- For `yarn dev:cf`: `cp apps/web/.dev.vars.example apps/web/.dev.vars`
