# Stack migration: Next.js + Prisma + tRPC → TanStack Start + Drizzle + D1/SQLite

Working branch: `claude/migrate-tanstack-drizzle-d1-c8bkot` (big-bang: the old app stays in the tree
as a reference until each slice is ported, then it is deleted).

## Target architecture

| Concern | Before | After |
| --- | --- | --- |
| Framework | Next.js (`apps/web`) | TanStack Start (`apps/start`) |
| Data access | Prisma + Postgres (`packages/prisma`) | Drizzle + SQLite (`packages/db`) |
| Internal API | tRPC (`packages/trpc`) | TanStack Start server functions (`createServerFn`) |
| Public API | NestJS (`apps/api/v2`) | TanStack Start server routes under `/api/v2/*` |
| Auth | NextAuth | Better Auth (`apps/start/src/server/auth`) |
| Hosting | Vercel / Docker (Node + Postgres) | Cloudflare Workers + D1, **or** Docker (Node + SQLite file) |

The same build serves both hosting targets. `DEPLOY_TARGET=cloudflare` switches the Vite build to the
Workers runtime; the only runtime-specific module is the DB driver (`apps/start/src/server/db/*.ts`,
selected through the `#db-driver` alias).

## Rules for ported code (D1 / SQLite constraints)

- **No interactive transactions.** D1 rejects `BEGIN`, so `db.transaction(async (tx) => …)` is not
  available. Atomic writes use `db.batch([...])`. When a later write depends on an earlier result,
  generate IDs up front (`cuid()` / `uuidv7()` from `@calcom/db/ids`) instead of reading them back.
- **No Postgres SQL.** Raw `$queryRaw`, Kysely queries, `ILIKE`, `DISTINCT ON`, and JSON path / array
  operators (`has`, `hasSome`, `path:`) need SQLite equivalents (`json_each`, `LIKE … COLLATE NOCASE`, …).
- **Arrays and `Json` are JSON text.** Columns typed `String[]`, `Int[]`, enum lists and `Json` are
  `text({ mode: "json" })`; filtering on their contents needs `json_each`.
- **Enums are TEXT holding the Prisma enum *name*** (e.g. `"UNLIMITED"`, not its `@map` value), so
  comparisons in existing business logic keep working. Import them from `@calcom/db/enums`.
- **Dates are integer milliseconds** (`timestamp_ms`), including former `@db.Date` / `@db.Time`.
- **`users.emailVerified` is a boolean** owned by Better Auth (it was a timestamp under NextAuth).
  `SecondaryEmail.emailVerified` is still a timestamp.
- **Keep the repository pattern.** Repositories swap Prisma for an injected `Database`; services
  don't change.

## Status

### Phase 1: foundation ✅
- [x] `packages/db`: Drizzle schema for all 100 models and 46 enums, generated from `schema.prisma`
- [x] Single baseline SQLite migration (`packages/db/migrations/0000_baseline.sql`), shared by
      `wrangler d1 migrations apply` and the libSQL migrator
- [x] Drivers: D1 (`@calcom/db/drivers/d1`) and libSQL/SQLite file (`@calcom/db/drivers/libsql`)
- [x] Tests against real SQLite: relations, JSON columns, foreign keys, atomic batches
- [x] `apps/start` skeleton with SSR and a DB-backed `/api/health` route
- [x] Cloudflare: `wrangler.jsonc` with D1 binding, verified locally with Miniflare
- [x] Docker: multi-arch Dockerfile (amd64 / arm64 / armv7) and single-service `docker-compose.yml`,
      with migrations on boot and data in a volume

### Phase 2: platform
- [x] Auth with Better Auth: email/password signup and login, Google sign-in (enabled when
      `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set), sessions, protected `_authed` routes.
      Verified in a browser on Node, Workers + D1, and the Docker image
- [ ] Auth follow-ups: email verification and password reset (need the email layer), 2FA
      (Better Auth `twoFactor` plugin, replacing `users.twoFactorSecret`), SAML/OIDC SSO
- [ ] App shell: Tailwind, `@calcom/ui`, i18n, layout and navigation
- [ ] Port `packages/lib` utilities off Next (`next/*` imports, `headers()`, `cookies()`)
- [ ] Data portability: Postgres → SQLite data export/import script. Existing passwords are bcrypt
      hashes in `UserPassword`; the import moves them to `Account.password` (provider `credential`),
      and `createAuth` will need a `password.verify` that also accepts `$2…` bcrypt hashes

### Phase 3: core booking (MVP)
- [ ] Repositories on Drizzle: User, EventType, Schedule/Availability, Booking, Attendee, Credential
- [ ] Slots / availability engine
- [ ] Public booking page (`/$user/$eventSlug`) and booking creation, with the seats and
      round-robin paths rewritten to use `db.batch`
- [ ] Event types, availability and bookings screens

### Phase 4: integrations, workflows and webhooks
- [ ] App-store runtime (credentials, OAuth callbacks as server routes)
- [ ] Calendar apps (Google, Outlook, CalDAV/Apple) and video apps (Zoom, Google Meet, Daily/Cal Video)
- [ ] Webhooks
- [ ] Workflows (email reminders; scheduled jobs via Workers Cron Triggers / a Node interval)
- [ ] Emails (SMTP on Docker; an HTTP provider on Workers, which can't open raw SMTP sockets)

### Phase 5: public API and cleanup
- [ ] Rebuild the `apps/api/v2` endpoints as Start server routes, keeping request/response shapes
- [ ] Delete `apps/web`, `apps/api/v2`, `packages/trpc`, `packages/prisma`, `packages/kysely`
- [ ] Rename `apps/start` → `apps/web`

## Auth

`createAuth()` in `apps/start/src/server/auth/createAuth.ts` configures Better Auth on top of the
existing tables:

- `users` is Better Auth's `user` model (`image` → `avatarUrl`, `createdAt` → `created`), with
  `username` and `timeZone` as extra fields. Usernames are slugified, checked for uniqueness among
  users outside an organization, and generated from the email for OAuth sign-ups.
- `Account` and `Session` use Better Auth's shape (the NextAuth columns are gone), `Verification`
  is new, and `UserPassword` is removed: credential hashes live in `Account.password`.
- All auth ids are serial integers, matching `users.id`.
- Passwords must pass Cal's existing `isPasswordValid` rule (7+ characters, upper and lower case,
  a number).
- Error codes sent to the client are translation keys; `src/lib/auth-errors.ts` maps Better
  Auth's own codes onto existing keys.

Settings: `BETTER_AUTH_SECRET` (required in production), `BETTER_AUTH_URL`, and optionally
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. See `apps/start/.env.example` (Node/Docker) and
`apps/start/.dev.vars.example` (Workers).

Cloudflare note: Better Auth hashes passwords with scrypt, which takes more CPU than the Workers
free plan allows per request (10 ms), so sign-up and login need the paid plan.

## Running it

```bash
yarn workspaces focus @calcom/start @calcom/db   # install only what the new stack needs

# Node + local SQLite file (migrations run on boot). Reads apps/start/.env.
yarn workspace @calcom/start dev

# Cloudflare Workers runtime locally (Miniflare + local D1). Reads apps/start/.dev.vars.
yarn workspace @calcom/db db:migrate:d1:local
yarn workspace @calcom/start dev:cf

yarn workspace @calcom/db test
yarn workspace @calcom/start test
```

### Deploy to Cloudflare

```bash
npx wrangler d1 create cal-diy        # put the printed database_id into apps/start/wrangler.jsonc
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL   # e.g. https://cal.example.com
yarn workspace @calcom/db db:migrate:d1:remote
yarn workspace @calcom/start deploy:cf
```

### Self-host with Docker (any machine, including a Raspberry Pi)

```bash
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "BETTER_AUTH_URL=http://raspberrypi.local:3000" >> .env   # the URL people will use
docker compose up -d --build
# or prebuild a multi-arch image:
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t cal-diy .
```

The SQLite database lives at `/data/cal.db` in the `cal-data` volume. Set `RUN_MIGRATIONS=false`
to manage migrations yourself.

## Changing the schema

Edit `packages/db/src/schema.ts` (and `relations.ts`), then run `yarn workspace @calcom/db db:generate`.
`packages/prisma/schema.prisma` is frozen and only kept as a reference until Phase 5.
