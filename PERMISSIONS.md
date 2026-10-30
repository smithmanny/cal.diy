# Cal.diy Permissions

How access control works in Cal.diy: who has which role, and where each check lives in the code.
There is no permission-string (PBAC) system; checks are role and ownership checks in middleware and
services.

## Layers

| Layer | What it does | Where |
| --- | --- | --- |
| Route `beforeLoad` | Redirects signed-out users to login, hides admin pages (`notFound()`). A convenience for the UI, not a security boundary | `apps/web/src/routes/_authed.tsx`, `apps/web/src/lib/admin-guard.ts` |
| Server function middleware | Rejects calls without a session (`401`) or without the admin role (`403`) | `authMiddleware` in `apps/web/src/server/middleware.ts`, `adminMiddleware` in `apps/web/src/server/admin/middleware.ts` |
| Services | Ownership and team-role checks on the specific record | `findOwned` in each service, `canManage` in `apps/web/src/server/teams/TeamService.ts` |
| Better Auth | Its own checks on the endpoints it serves (admin plugin, organization plugin, API keys) | `apps/web/src/server/auth/createAuth.ts`, `organizations.ts` |
| API v2 | API key or OAuth token, then the same services | `apps/web/src/server/api-v2/http.ts`, `auth.ts` |

Server functions are HTTP endpoints anyone can call, so the server function and service checks are
the ones that protect data. Records someone may not see answer `404` (`not_found`,
`booking_not_found`, `team_not_found`) rather than `403`, so ids can't be probed.

## Instance roles (Better Auth admin plugin)

`users.role` is Cal's `UserPermissionRole`: `USER` or `ADMIN`. The plugin is configured in
`adminPlugin()` in `apps/web/src/server/auth/createAuth.ts` (`defaultRole: "USER"`,
`adminRoles: ["ADMIN"]`, Better Auth's `adminAc` / `userAc` permissions).

- The first account created on an empty install becomes `ADMIN` (user create hook in `createAuth.ts`); everyone after is `USER`
- Admins manage users at `/settings/admin/users` (edit, change role, lock/unlock, impersonate, send a password reset, delete) and OAuth clients at `/settings/admin/oauth`
- Every admin server function uses `adminMiddleware`: a session, `role === "ADMIN"`, and in production builds two-factor authentication turned on (`admin_needs_two_factor` otherwise). Better Auth's own `/admin/*` endpoints apply the same two-factor rule in `beforeHook`, except stopping an impersonation
- The admin routes call `requireAdmin(context)` in `beforeLoad`, using `isAdmin` from the session (`apps/web/src/server/auth/session.ts`)
- A lock is the plugin's ban, stored in `users.locked`: locked users can't sign in
- Impersonation is recorded in `Session.impersonatedBy`; every page shows a banner to stop it

Promote someone from the admin pages, or with
`UPDATE users SET role = 'ADMIN' WHERE email = '…'`.

## Team and organization roles (Better Auth organization plugin)

Teams and organizations are Cal `Team` rows, each a Better Auth organization
(`teamsPlugin()` in `apps/web/src/server/auth/organizations.ts`). `Membership.role` holds Cal's
`MembershipRole`, mapped to Better Auth's default permissions:

| Role | Better Auth permissions | In practice |
| --- | --- | --- |
| `OWNER` | `ownerAc`: update and delete the organization; create, update, remove members; create and cancel invitations | Everything, including deleting the team |
| `ADMIN` | `adminAc`: update the organization; create, update, remove members; create and cancel invitations | Edit the team, invite and manage members, manage team event types and team apps |
| `MEMBER` | `memberAc`: none | See the team and its members; leave it |

- Whoever creates a team becomes its `OWNER` (`creatorRole: "OWNER"`). Any signed-in user can create a team or an organization
- Creating a team inside an organization needs `OWNER` or `ADMIN` of that organization (`TeamService.assertCanCreateIn`)
- Writes to teams, members and invitations go through Better Auth's endpoints from `apps/web/src/server/teams/functions.ts`, so the plugin checks the role; `withTeamErrors` (`teams/errors.ts`) turns its refusals into `AppError("unauthorized", 403)` and its conflicts into translated `409`s
- Reads go through `TeamService`: a team's page needs a membership (`team_not_found` otherwise), and pending invitations are only returned to owners and admins
- The last owner can't leave (`team_needs_an_owner`)
- Invitations are for one email address and need a verified email to accept (`verify_email_to_join_team`), because invitation ids are sequential

### `canManage`

`canManage(role)` in `apps/web/src/server/teams/TeamService.ts` is true for `OWNER` and `ADMIN`. It is
the check for team-owned things outside Better Auth:

| Action | Check |
| --- | --- |
| Edit or delete a team event type | `EventTypeService.findOwned` with the `canManageTeam` dependency (`event-types/container.ts`) |
| Create team event types, set hosts | `TeamEventTypeService.assertManager` |
| Install an app for a team (`/api/integrations/<app>/add?teamId=`) | `AppsService.assertTeamInstall` |
| Create a team inside an organization | `TeamService.assertCanCreateIn` |

## Personal resources

Everything else belongs to one user and is checked against the session's user id in the service:

| Resource | Check |
| --- | --- |
| Event types (personal) | `EventTypeService.findOwned`: `eventType.userId === userId` |
| Schedules | `ScheduleService.findOwned` |
| Webhooks | `WebhookService.findOwned`: `webhook.userId === userId` |
| Calendar and app credentials | `CalendarService.findOwnedCredential` and the apps service |
| API keys | Better Auth's api-key plugin, keyed to the user (`apps/web/src/server/api-keys/functions.ts`) |
| Out of office, profile, settings, push subscriptions | Scoped by `context.userId` in their services |

## Bookings

| Who | Can |
| --- | --- |
| Anyone | View public profiles, event types and slots, and book (`apps/web/src/server/bookings/functions.ts`, no middleware) |
| Anyone with the booking's `uid` | See the booking page, cancel or reschedule it (the uid is an unguessable token sent to the attendee and host) |
| The host (`booking.userId`) | Confirm or reject, mark no-shows, add guests, change the location, request a reschedule, see the history (`BookingActionsService.hostBooking`, `BookingService.decide`, `cancelAsHost`) |

Host-only actions answer `booking_not_found` (404) for anyone else.

## OAuth provider

- Admins create and delete clients (`adminMiddleware` in `apps/web/src/server/oauth/functions.ts`)
- A signed-in user approves a client on `/auth/oauth2/authorize` (`authMiddleware` on `approveOAuthAuthorization`)
- Access tokens only grant reading through API v2: `READ_BOOKING` for `/api/v2/bookings`, `READ_PROFILE` for everything else (`oauthScopeFor` in `apps/web/src/server/api-v2/auth.ts`). Any write with an OAuth token is refused with `403`

## API v2

Requests authenticate with `Authorization: Bearer cal_…` (an API key, verified and rate-limited to
120 requests a minute by Better Auth's api-key plugin) or with an OAuth access token (read only, see
above). The key acts as its owner.

- `apiRoute(handler)` needs credentials (`401` without)
- `publicApiRoute(handler)` works without them and treats the key's owner as the signed-in user when present (e.g. the host's key cancels as host)
- After authentication the route calls the same services as the app, so the ownership and role checks above apply unchanged

Which endpoints need a key is listed in `MIGRATION.md` ("API v2").

## Adding a check

1. Put `authMiddleware` (or `adminMiddleware`) on the server function
2. Check ownership or `canManage` in the service, and throw `AppError("not_found", 404)` when it fails
3. Add a `beforeLoad` guard to the route if the page shouldn't render for others
4. Test the refusal: another user's or another team's record must not be readable or writable
