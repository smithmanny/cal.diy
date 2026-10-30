---
title: Local Development Setup
impact: LOW
tags: reference, setup, local-dev
---

# Local Development Setup

## Initial Setup

Needs Node.js 22+ and Yarn (`corepack enable` once).

```bash
yarn install
cp apps/web/.env.example apps/web/.env
```

## Environment Variables

Generate the required secrets and put them in `apps/web/.env`:

```bash
# BETTER_AUTH_SECRET
openssl rand -base64 32

# CALENDSO_ENCRYPTION_KEY (32 characters, for AES-256; encrypts app credentials and signs OAuth tokens)
openssl rand -base64 24
```

Everything else is optional; the comments in `.env.example` say what each integration needs.
`DATABASE_URL` defaults to `file:./data/cal.db` (relative to `apps/web`). Without email settings
(`EMAIL_FROM` plus `RESEND_API_KEY` or `EMAIL_SERVER_*`) no emails are sent.

## Running

```bash
# Node + local SQLite file on http://localhost:3000; migrations run on boot
yarn dev

# Cloudflare Workers runtime (Miniflare + local D1); reads apps/web/.dev.vars
cp apps/web/.dev.vars.example apps/web/.dev.vars
yarn db:migrate:d1:local
yarn dev:cf
```

## Users

There are no seeded test users. Sign up at `/auth/signup`; the first account on an empty database
becomes the instance admin. To promote another account:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

In production builds an admin must turn on two-factor authentication before the admin pages work.

## Database

```bash
yarn db:generate                          # write a migration after editing packages/db/src/schema.ts
yarn workspace @calcom/db db:studio       # browse the database with Drizzle Studio
sqlite3 apps/web/data/cal.db              # or open the SQLite file directly
```

To start over locally, stop the server and delete `apps/web/data/cal.db`.

## Importing an existing Cal install

```bash
yarn import:postgres --from "postgresql://user:pass@host:5432/calendso" --to file:./data/cal.db
```

See `MIGRATION.md` ("Migrating from an existing Cal install") for the D1 variant and what comes across.

## Logging

There is no log-level setting: the server logs with `console.error` / `console.warn`. On Node the
output is in the terminal running `yarn dev`; on Workers, in `wrangler tail` or the dashboard.
