# Stack migration: Next.js + Prisma + tRPC → TanStack Start + Drizzle + D1/SQLite

Working branch: `claude/migrate-tanstack-drizzle-d1-c8bkot`. This is a big-bang migration: the new
app lives in `apps/start` beside the old one, which stays in the tree as a reference until the
remaining slices are ported and it can be deleted in one step (Phase 5).

## Target architecture

| Concern | Before | After |
| --- | --- | --- |
| Framework | Next.js (`apps/web`) | TanStack Start (`apps/start`) |
| Data access | Prisma + Postgres (`packages/prisma`) | Drizzle + SQLite (`packages/db`) |
| Internal API | tRPC (`packages/trpc`) | TanStack Start server functions (`createServerFn`) |
| Public API | NestJS (`apps/api/v2`) | TanStack Start server routes under `/api/v2/*` |
| Auth | NextAuth | Better Auth (`apps/start/src/server/auth`) |
| Hosting | Vercel / Docker (Node + Postgres) | Cloudflare Workers + D1, **or** Docker (Node + SQLite file) |

The same code serves both hosting targets. `DEPLOY_TARGET=cloudflare` switches the Vite build to the
Workers runtime; everything runtime-specific (database, static asset reads, background work, SMTP,
trusted client-IP header) sits behind the `#runtime` alias in `apps/start/src/server/runtime/`.

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
- **At most 100 bound parameters per statement** on D1. Multi-row inserts go through
  `chunkRowsForInsert` (`@calcom/db/insert-chunks`); local SQLite allows far more, so only the
  Workers e2e run catches a miss.
- **Check-then-write in one statement.** `conditionalInsert` (`@calcom/db/conditional-insert`)
  builds `INSERT … SELECT … WHERE`, e.g. "insert this booking only if the slot is still free".
- **Production checks use `IS_PRODUCTION_BUILD`** (`import.meta.env.PROD`), not `NODE_ENV`, which
  Workers don't set.
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

### Phase 2: platform ✅
- [x] Auth with Better Auth: email/password and Google sign-in, sessions, protected `_authed` routes,
      per-IP rate limiting on a trusted client IP (see Auth below)
- [x] App shell: Tailwind 4, `@coss/ui` components with Cal's theme tokens, navigation, settings tabs
- [x] i18n from `packages/i18n/locales`: locale from the user or `Accept-Language`, right-to-left
      layouts, each route loads only the keys it uses
- [x] CSRF protection on server functions (`createCsrfMiddleware`); errors that aren't `AppError`s
      reach the client as `something_went_wrong`
- [x] Email verification, password reset, 2FA (Better Auth `twoFactor`)
- [ ] SAML/OIDC SSO
- [x] Instance admin with Better Auth's `admin` plugin: users list, edit, lock/unlock,
      impersonate, password reset, delete (`/settings/admin/users`)
- [x] OAuth 2.0 provider for third-party apps: admin-managed clients (`/settings/admin/oauth`),
      consent at `/auth/oauth2/authorize`, tokens at `/api/auth/oauth/token` (see Auth below)
- [x] Data import from an existing Cal Postgres install (`import:postgres`, see
      [Migrating from an existing Cal install](#migrating-from-an-existing-cal-install)). Sign-in
      accepts the imported bcrypt hashes and upgrades them to scrypt

### Phase 3: core booking ✅
- [x] Repositories on Drizzle: User, EventType, Schedule/Availability, Booking/Attendee, Credential,
      Webhook, SelectedCalendar, BookingReference
- [x] Slots engine (`packages/scheduling`): a port of Cal's `date-ranges` and `slots` with their tests,
      plus buffers, minimum notice, a rolling booking window and busy times
- [x] Availability: schedules with weekly hours and date overrides, default schedule, time zones
- [x] Event types: create, edit (length, locations, minimum notice, buffers, booking window,
      requires confirmation), hide, delete
- [x] Public pages `/$username` and `/$username/$slug`, booking with a slot that can't be double-booked,
      reschedule and cancel from `/booking/$uid`
- [x] Bookings list (upcoming, unconfirmed, past, cancelled) with confirm, reject and cancel
- [ ] Teams, organizations, seats, round robin, recurring events, payments, per-period booking
      and duration limits

### Phase 4: integrations, webhooks, emails ✅ (MVP set)
- [x] Google Calendar: OAuth connect, busy times from selected calendars, events created, moved and
      deleted with bookings; Google Meet links. Credentials encrypted with `CALENDSO_ENCRYPTION_KEY`
      in Cal's format, so existing keys keep working
- [x] Webhooks: Cal-compatible payloads, `X-Cal-Signature-256` HMAC, custom templates (`{{var}}`
      only), BOOKING_CREATED/REQUESTED/RESCHEDULED/CANCELLED/REJECTED
- [x] Emails: localized organizer and attendee emails with `.ics`, over Resend (both runtimes) or
      SMTP (Node/Docker)
- [ ] Workflows: this fork has no workflows feature, so there was nothing to port
- [ ] Other app-store apps (Outlook, CalDAV/Apple, Zoom, Daily/Cal Video, …)

### Phase 5: public API and cleanup
- [x] Rebuild the `apps/api/v2` endpoints for the MVP domain as Start server routes, keeping
      request/response shapes (see API v2 below)
- [ ] API v2 endpoints outside the MVP domain: teams, organizations, OAuth clients and managed
      users, calendars, conferencing, booking seats and attendees, reassign, host no-shows
- [ ] Delete `apps/web`, `apps/api/v2`, `packages/trpc`, `packages/prisma`, `packages/kysely`
- [ ] Rename `apps/start` → `apps/web`

## Auth

`createAuth()` in `apps/start/src/server/auth/createAuth.ts` configures Better Auth on top of the
existing tables:

- `users` is Better Auth's `user` model (`image` → `avatarUrl`, `createdAt` → `createdDate`), with
  `username`, `timeZone` and `locale` as extra fields. Usernames are slugified, checked for uniqueness among
  users outside an organization, and generated from the email for OAuth sign-ups.
- `Account` and `Session` use Better Auth's shape (the NextAuth columns are gone), `Verification`
  is new, and `UserPassword` is removed: credential hashes live in `Account.password`.
- All auth ids are serial integers, matching `users.id`.
- Passwords must pass Cal's existing `isPasswordValid` rule (7+ characters, upper and lower case,
  a number).
- Error codes sent to the client are translation keys; `src/lib/auth-errors.ts` maps Better
  Auth's own codes onto existing keys.
- New users get Cal's defaults: a working-hours schedule and "15min"/"30min" event types.
- Production builds rate-limit sign-in and sign-up per client IP. The IP comes from a header the
  runtime guarantees: `cf-connecting-ip` on Workers, and on Node a header `server.node.mjs` sets
  from the socket. Behind a reverse proxy, set `TRUST_PROXY` (see `.env.example`) or every client
  shares the proxy's limit.

### Admin

Better Auth's `admin` plugin runs on Cal's columns: roles are `users.role` (`USER`/`ADMIN`), a
ban is `users.locked` (locked users can't sign in), and impersonation is recorded in
`Session.impersonatedBy`. As with Cal's self-host setup, the first account created on an empty
install becomes its admin; to promote someone later, use the admin pages or
`UPDATE users SET role = 'ADMIN' WHERE email = '…'`. As in Cal, production builds treat an admin
without two-factor authentication as inactive: the admin pages and the plugin's endpoints refuse
them until they turn it on. While impersonating, every page shows a banner to stop.

### OAuth provider

Cal's own OAuth provider, ported onto its `OAuthClient` and `AccessCode` tables (this Better Auth
version ships no OAuth/OIDC provider plugin, so it isn't built on one). Admins create clients;
confidential clients get a secret shown once and stored as Cal's SHA-256 digest. Users approve on
`/auth/oauth2/authorize` (`client_id`, `redirect_uri`, `state`, `scope`, PKCE `code_challenge`
with `S256`, required for public clients). `POST /api/auth/oauth/token` exchanges codes
(`grant_type=authorization_code`) and refresh tokens (`grant_type=refresh_token`; Cal's
`/api/auth/oauth/refreshToken` also works), with the client secret in the body or HTTP Basic.
Access tokens (30 minutes) and refresh tokens (30 days) are HS256 JWTs signed with
`CALENDSO_ENCRYPTION_KEY` in Cal's claim format, so tokens an existing Cal install issued stay
valid. API v2 accepts access tokens as `Bearer` for reading only: `READ_BOOKING` for
`/v2/bookings`, `READ_PROFILE` for everything else; `/api/auth/oauth/me` answers as in Cal.

Settings: `BETTER_AUTH_SECRET` (required in production), `BETTER_AUTH_URL`, and optionally
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; `CALENDSO_ENCRYPTION_KEY` (required in production
for calendar credentials and OAuth tokens). See `apps/start/.env.example` (Node/Docker) and
`apps/start/.dev.vars.example` (Workers).

Cloudflare note: Better Auth hashes passwords with scrypt, which takes more CPU than the Workers
free plan allows per request (10 ms), so sign-up and login need the paid plan.

## API v2

`apps/start/src/routes/api/v2/` serves Cal's public API on the same paths and shapes as
`apps/api/v2`. `src/server/api-v2/http.ts` holds what every endpoint shares: `Authorization: Bearer
cal_…` API keys (verified by Better Auth's api-key plugin, which also rate-limits each key to 120
requests a minute), the `cal-api-version` header, the `{ status: "success", data }` envelope with
`pagination` on lists, and Cal's error shape (`{ status: "error", timestamp, path, error: { code,
message } }`, with Nest's exception names as codes and English messages). Mappers in the same folder
translate between the API's DTOs and the app's services, so no database row reaches a response.

| Endpoint | `cal-api-version` | Auth |
| --- | --- | --- |
| `GET`, `PATCH /v2/me` (email changes stay in settings, which verify them) | – | key |
| `GET /v2/event-types` (yours, or `?username=`[`&eventSlug=`] publicly), `POST` | 2024-06-14 | key / optional |
| `GET`, `PATCH`, `DELETE /v2/event-types/:id` | 2024-06-14 | key |
| `GET`, `POST /v2/schedules`, `GET /v2/schedules/default`, `GET`, `PATCH`, `DELETE /v2/schedules/:id` | 2024-06-11 | key |
| `GET /v2/slots` (by `eventTypeId`, or `username` + `eventTypeSlug`; `format=range`) | 2024-09-04 | optional |
| `POST /v2/bookings` (single, recurring, seated), `GET /v2/bookings/:uid` | 2024-08-13 | optional |
| `GET /v2/bookings` (status, attendee, event type and date filters; sorting; `take`/`skip`) | 2024-08-13 | key |
| `POST /v2/bookings/:uid/cancel`, `/reschedule` | 2024-08-13 | optional (the host's key cancels as host) |
| `POST /v2/bookings/:uid/confirm`, `/decline` | 2024-08-13 | key (host) |
| `POST /v2/bookings/:uid/mark-absent` (attendees only; `host: true` is a 400), `POST /v2/bookings/:uid/guests`, `PATCH /v2/bookings/:uid/location` (address, link, phone, Google Meet) | 2024-08-13 | key (host) |
| `GET`, `POST /v2/webhooks`, `GET`, `PATCH`, `DELETE /v2/webhooks/:id` | – | key |

Versioned endpoints answer 400 to any other `cal-api-version`, since the older shapes Cal routes
those to aren't served. Event type input accepts the settings this app has and rejects unknown
fields (e.g. `price`) rather than ignoring them.

## Running it

```bash
yarn workspaces focus @calcom/start @calcom/db @calcom/scheduling   # only what the new stack needs

# Node + local SQLite file (migrations run on boot). Reads apps/start/.env.
yarn workspace @calcom/start dev

# Cloudflare Workers runtime locally (Miniflare + local D1). Reads apps/start/.dev.vars.
yarn workspace @calcom/db db:migrate:d1:local
yarn workspace @calcom/start dev:cf
```

### Tests

```bash
yarn workspace @calcom/db test
yarn workspace @calcom/scheduling test
yarn workspace @calcom/start test

# Browser tests. By default they start the dev server on a throwaway SQLite file, with a fake
# Google and a webhook receiver on localhost.
yarn workspace @calcom/start test:e2e
# Against a running production build instead (Node with TRUST_PROXY=loopback, a Workers preview
# from `vite preview`, or the Docker image). E2E_FAKES=1 also runs the webhook spec; the Google
# spec needs the dev server, since production builds ignore endpoint overrides.
E2E_BASE_URL=http://localhost:3000 yarn workspace @calcom/start test:e2e
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

## Migrating from an existing Cal install

`import:postgres` copies an existing Cal database into the new schema. It reads Postgres with the
`psql` client (no driver to install) and either writes a SQLite/libSQL database directly or
produces a SQL file for D1. Run it from a checkout of this repo; the old install can stay up and is
only read.

```bash
export BETTER_AUTH_SECRET=…        # the secret the new app will run with
export CALENDSO_ENCRYPTION_KEY=…   # the old install's key (keep it for the new app too)

# Docker / Node: writes and migrates a new SQLite file, then copy it into the `cal-data` volume
# as /data/cal.db
yarn workspace @calcom/start import:postgres --from "postgresql://user:pass@host:5432/calendso" \
  --to file:./data/cal.db

# Cloudflare: apply the migrations to the D1 database first, then load the generated SQL
yarn workspace @calcom/db db:migrate:d1:remote
yarn workspace @calcom/start import:postgres --from "postgresql://…" --sql import.sql
npx wrangler d1 execute cal-diy --remote --file import.sql
```

What comes across, with ids unchanged:

- Users, schedules and availability, event types (with hosts and private links), bookings with
  attendees, seats and calendar references, credentials (still encrypted with
  `CALENDSO_ENCRYPTION_KEY`), selected and destination calendars, webhooks, travel schedules,
  out-of-office entries, holiday settings, secondary emails, and the `App` rows with their keys.
- **Passwords**: `UserPassword` bcrypt hashes become Better Auth credential accounts. Sign-in
  checks them with a pure-JS bcrypt (it runs on Workers too) and replaces each with an scrypt
  hash the first time it matches.
- **Google sign-in**: NextAuth `Account` rows become Better Auth accounts. Google users without
  one are linked by email on their next Google sign-in.
- **API keys**: personal keys keep working. Cal stored SHA-256 of the key as hex and Better Auth
  stores the same digest as base64url, so the import converts it.
- **2FA** stays on for everyone who had it, with their unused backup codes (re-encrypted with
  `BETTER_AUTH_SECRET`). The authenticator secret can't come along: Cal keyed TOTP with the
  base32-decoded secret, Better Auth with the secret's text. Those users sign in with a backup code
  and then set up their authenticator app again. The import lists anyone with no codes left; to
  let them in, delete their `TwoFactor` row and set `users.twoFactorEnabled` to 0.

What doesn't:

- Sessions: everyone signs in again.
- Teams and organizations, and everything they own (team event types, team webhooks, credentials
  and API keys), until they land in the new app. References to them are cleared: an organization
  member becomes a regular user, a booking of a team event type keeps its host and attendees, and
  a managed event type's per-user copies become ordinary event types.
- Tables the new app has no feature for yet (workflows, routing forms, insights, payments, …).

## Changing the schema

Edit `packages/db/src/schema.ts` (and `relations.ts`), then run `yarn workspace @calcom/db db:generate`.
`packages/prisma/schema.prisma` is frozen and only kept as a reference until Phase 5.
