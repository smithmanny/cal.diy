# Knowledge Base - Domain & Product-Specific Information

Domain knowledge about the Cal.diy product and codebase. For coding guidelines, see [`rules/`](rules/);
for what changed in the move off Cal's old stack, see [`../MIGRATION.md`](../MIGRATION.md).

## Data compatibility with Cal

The database keeps Cal's tables, columns and enum values (as SQLite text), so an existing Cal
install can be imported with `yarn import:postgres` and its credentials, event type locations,
booking references and API keys keep working. When you add or change something, keep Cal's names
and formats unless there is a reason not to.

## Bookings

`Booking.status` (`BookingStatus` in `@calcom/db/enums`):
- `ACCEPTED` - confirmed
- `PENDING` - waiting for the host to confirm (event type `requiresConfirmation`, optionally only for short notice), or waiting for payment on a paid event
- `REJECTED` - the host declined a pending booking
- `CANCELLED` - cancelled by host or attendee (`cancellationReason` is optional free text); also set, with `rescheduled = true`, on the old booking when one is rescheduled (the new booking's `fromReschedule` points back at it)
- `AWAITING_HOST` - Cal's status, shown in booking history; this app doesn't create it

The bookings list (`/bookings/<status>`) has the tabs `upcoming`, `unconfirmed`, `recurring`, `past`
and `cancelled`.

- Each booking has a public `uid`; the confirmation page `/booking/<uid>` and the cancel/reschedule links use it, so treat it as a secret token
- `iCalUID` is `<uid>@cal.diy`; `.ics` files and calendar events use it so calendar apps update the same event on reschedule or cancel
- Booking changes publish a `BookingEvent` (`apps/web/src/server/bookings/events.ts`); emails, webhooks, calendar sync, video meetings, refunds, push notifications and the audit log are listeners (`bookings/integrations.ts`)
- Booking history uses Cal's `BookingAudit` format (`bookings/auditListener.ts`, `bookingHistory.ts`)
- A slot can't be double-booked: the insert checks the slot is still free in the same statement (`BookingRepository.insertIfSlotFree`)

## Event types

- Owned by a user (`userId`) or a team (`teamId`)
- `schedulingType` for team event types: `COLLECTIVE` (every host must be free and all attend; the first organizes) or `ROUND_ROBIN` (one free host takes it; "fixed" hosts always attend). Hosts are `Host` rows, or the whole team with "Assign all team members"
- Round robin picks, among the hosts free at that time, the one booked least recently for that event type (`BookingService.pickRoundRobinHost`). Cal's weights and priorities are not used
- `MANAGED` exists in the enum, but managed event types aren't ported: the import skips the team's template and each member's copy becomes their own event type
- Booking window: `periodType` `UNLIMITED`, `ROLLING` (N days), `ROLLING_WINDOW` (N days that have availability) or `RANGE`
- Other settings: length (and multiple durations), locations, minimum notice, buffers, booking and duration limits, seats, recurring series, requires confirmation, hidden, private links (`HashedLink`, served at `/d/<link>/<slug>`), booking questions, paid events (Stripe in `metadata.apps.stripe`)
- Dynamic group links: `/alice+bob` books everyone named, at times when all are free; the first person organizes

## Teams and organizations

Teams run on Better Auth's organization plugin (`apps/web/src/server/auth/organizations.ts`) on Cal's
own tables:

- Both are rows in `Team`. An **organization** has `isOrganization = true`; **teams inside it** have `parentId` pointing at it
- Members are `Membership` rows with Cal's roles `OWNER`, `ADMIN`, `MEMBER`. Owners and admins edit the team, invite people and manage team event types; only owners delete the team
- Invitations are `TeamInvitation` rows, emailed, valid for a week, and need a verified email to accept
- Team event types are booked at `/team/<slug>/<type>` and listed on `/team/<slug>`
- Not ported: managed event types, routing forms, org subdomains and org-scoped usernames, team billing, SCIM

See [`../PERMISSIONS.md`](../PERMISSIONS.md) for who can do what.

## OAuth clients

| Type | Table | Status here |
|------|-------|-------------|
| OAuth client | `OAuthClient` | Used: Cal's OAuth provider for third-party apps (admins manage clients at `/settings/admin/oauth`) |
| Platform OAuth client | `PlatformOAuthClient` | Table kept for Cal compatibility; the platform (managed users, `x-cal-client-id` headers) is not ported |

If someone says "platform OAuth client" they mean the `PlatformOAuthClient` table.

## Instance admin

The first account on an empty install becomes the admin (`users.role = 'ADMIN'`). There are no
seeded test users. In production builds an admin without two-factor authentication can't use the
admin pages.

## Apps

The app catalog is `apps/web/src/lib/apps.ts` (Google, Outlook, CalDAV and Apple calendars; Zoom,
Microsoft Teams, Cal Video, Jitsi and room-link video apps; Stripe). See `MIGRATION.md` ("Apps") for
the settings each needs.

## Webhooks

Cal-compatible payloads signed with `X-Cal-Signature-256` (HMAC of the body with the webhook's
secret). Triggers (`SUPPORTED_TRIGGERS` in `apps/web/src/server/webhooks/types.ts`): `BOOKING_CREATED`,
`BOOKING_REQUESTED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_REJECTED`,
`BOOKING_NO_SHOW_UPDATED`. Custom payload templates support `{{variable}}` only.
There is no workflows feature in this fork; workflows and webhooks are not related.

## API v2

`/api/v2/*` serves a subset of Cal's API v2 with Cal's shapes and `cal-api-version` headers;
`MIGRATION.md` ("API v2") lists the endpoints. API keys are `cal_...` bearer tokens, rate-limited to
120 requests a minute. `docs/api-reference/v2/openapi.json` is Cal's full spec, not generated from this
code.

## Translations

UI strings are keys in `packages/i18n/locales/<lang>/common.json`. New English keys go above
`ADD_NEW_STRINGS_ABOVE_THIS_LINE_TO_PREVENT_MERGE_CONFLICTS`; other languages are filled in by the i18n
workflow. Each route loads only the keys in its `MESSAGE_KEYS`, so add new keys there too.

## Runtime targets

- Cloudflare Workers + D1: no SMTP (use Resend), no interactive transactions, 100 bound parameters per statement, CPU limits per request (password hashing needs the paid plan)
- Node/Docker + SQLite file: migrations on boot, SMTP or Resend, `TRUST_PROXY` behind a reverse proxy
