---
paths:
  - "packages/db/**"
title: Drizzle Schema and Migrations
impact: HIGH
impactDescription: Schema changes affect all downstream code and both deployment targets
tags: drizzle, database, migrations, schema, d1, sqlite
---

# Drizzle Schema and Migrations

**Impact: HIGH**

The schema is `packages/db/src/schema.ts` (relations in `src/relations.ts`, enums in
`src/enums.ts`). Migrations are plain SQLite SQL in `packages/db/migrations/`, shared by both
targets: `wrangler d1 migrations apply` on Cloudflare, and the libSQL migrator on Node/Docker,
which runs them on boot (unless `RUN_MIGRATIONS=false`).

Schema changes need agreement first (`CLAUDE.md`, "Ask first"), and the migration has to work on D1.

## Changing the schema

```bash
# 1. Edit packages/db/src/schema.ts (and relations.ts / enums.ts if needed)
# 2. Generate the migration and its snapshot
yarn db:generate
# 3. Apply it locally
yarn dev                     # Node: migrations run on boot
yarn db:migrate:d1:local     # Workers: local D1 for yarn dev:cf
# 4. Production D1
yarn db:migrate:d1:remote
```

Commit the generated `.sql` file together with `migrations/meta/` (the journal and snapshot).
Never edit a migration that has already shipped; add a new one.

## D1 / SQLite rules (from MIGRATION.md)

- **No interactive transactions.** `db.transaction(...)` doesn't work on D1. Write atomically with `db.batch([...])`, generating ids up front (`cuid()` / `uuidv7()` from `@calcom/db/ids`) when a later statement needs an earlier one's id
- **No Postgres SQL.** No `ILIKE`, `DISTINCT ON`, array or JSON-path operators; use `LIKE … COLLATE NOCASE` and `json_each`
- **Arrays and JSON are JSON text**: `text({ mode: "json" })`; filter on their contents with `json_each`
- **Enums are TEXT** holding the enum name (e.g. `"ACCEPTED"`); import them from `@calcom/db/enums`
- **Dates are integer milliseconds** (`integer({ mode: "timestamp_ms" })`)
- **At most 100 bound parameters per statement** on D1: split multi-row inserts with `chunkRowsForInsert` (`@calcom/db/insert-chunks`). Local SQLite allows far more, so only the Workers build catches a miss
- **Check-then-write in one statement** with `conditionalInsert` (`@calcom/db/conditional-insert`), e.g. inserting a booking only if the slot is still free
- **Production checks use `IS_PRODUCTION_BUILD`**, not `NODE_ENV`, which Workers don't set

**Incorrect:**

```typescript
await db.transaction(async (tx) => {
  await tx.update(schedule).set({ name }).where(eq(schedule.id, id));
  await tx.delete(availability).where(eq(availability.scheduleId, id));
});
```

**Correct (`schedules/ScheduleRepository.ts`):**

```typescript
await this.db.batch([
  this.db.update(schedule).set({ name: data.name, timeZone: data.timeZone }).where(eq(schedule.id, data.id)),
  this.db.delete(availability).where(eq(availability.scheduleId, data.id)),
  ...availabilityInserts(this.db, data.availability, data.id, data.userId),
]);
```

## Data migrations and seeds

Seed rows and data fixes are SQL migrations too, written to be safe to run once on any install,
e.g. `0002_seed_out_of_office_reasons.sql` (`INSERT OR IGNORE ...`) and
`0005_mark_existing_users_onboarded.sql`. Separate statements with `--> statement-breakpoint`, as the
generated files do.

## New columns

- New columns on existing tables need a default or must be nullable, since existing rows get no value
- Don't give `createdAt`/`updatedAt` a default if existing rows should stay null; set them in the repository on insert/update
- Data imported from Cal (`yarn import:postgres`) must still load: check `apps/web/scripts/` when you rename or retype a column Cal had
