---
name: calcom-api
description: Call the API v2 of a self-hosted Cal.diy instance (served at <your Cal.diy URL>/api/v2) to read and update the signed-in user's profile, event types, availability schedules and webhooks, look up free slots, and create, list, cancel, reschedule, confirm or decline bookings. Use this skill when building an integration against a Cal.diy instance, or when receiving and verifying its booking webhooks.
env:
  CAL_API_URL:
    description: "The instance's API base: your Cal.diy URL plus /api/v2, e.g. http://localhost:3000/api/v2."
    required: true
  CAL_API_KEY:
    description: "API key (cal_ followed by 32 hex characters), created under Settings > Developer > API keys. Needed for every endpoint except the public ones."
    required: false
  CAL_WEBHOOK_SECRET:
    description: "The secret set on a webhook, used to check the X-Cal-Signature-256 header of each delivery."
    required: false
---

# Cal.diy API v2

Each Cal.diy instance serves its own API. The base URL is your Cal.diy URL plus `/api/v2`:

```
http://localhost:3000/api/v2
https://cal.example.com/api/v2
```

The endpoints follow Cal.com's API v2 paths and shapes, but only the endpoints listed below exist.

## Authentication

Send an API key, or an OAuth access token, as a Bearer token:

```
Authorization: Bearer cal_0123456789abcdef0123456789abcdef
```

- **API keys** act as the user who created them, with full read and write access. Create them
  under **Settings > Developer > API keys** (`/settings/developer/api-keys`). The key is shown
  once. Keys can expire after 7, 30, 90 or 365 days, or never. Each key is limited to 120
  requests a minute.
- **OAuth access tokens** come from the instance's OAuth 2.0 provider (clients are registered by
  an admin). They can only call `GET` endpoints: `READ_BOOKING` for `/bookings...`, `READ_PROFILE`
  for everything else.
- **Public endpoints** work without a header. When a key is sent, they act as its owner.

See [references/authentication.md](references/authentication.md) for key handling, the OAuth flow
and `GET`/`PATCH /me`.

## Version header

Most endpoints need a `cal-api-version` header with one exact value. Any other value, or no header,
gets a 400 before the credentials are checked:

| Endpoints | `cal-api-version` |
| --- | --- |
| `/bookings/**` | `2024-08-13` |
| `/event-types/**` | `2024-06-14` |
| `/schedules/**` | `2024-06-11` |
| `/slots` | `2024-09-04` |
| `/me`, `/webhooks/**` | none (the header is ignored) |

## Responses

Success:

```json
{ "status": "success", "data": { } }
```

`data` is an object, an array, or `null` (for example after deleting a schedule). Creating a booking,
event type, schedule or webhook, and rescheduling a booking, answer `201`. Everything else answers
`200`.

`GET /bookings` is the only paginated endpoint. It adds `pagination` next to `data`:

```json
{
  "status": "success",
  "data": [],
  "pagination": {
    "totalItems": 6,
    "remainingItems": 3,
    "returnedItems": 2,
    "itemsPerPage": 2,
    "currentPage": 1,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

Page with `take` (1 to 250, default 100) and `skip` (default 0). Other lists return everything.

## Errors

```json
{
  "status": "error",
  "timestamp": "2026-10-30T11:52:07.790Z",
  "path": "/api/v2/me",
  "error": { "code": "UnauthorizedException", "message": "Unauthorized" }
}
```

| Status | `error.code` | Typical cause |
| --- | --- | --- |
| 400 | `BadRequestException` | Missing or wrong `cal-api-version`, invalid JSON, a field that fails validation, or a rule such as an invalid time zone |
| 401 | `UnauthorizedException` | No credentials on a private endpoint, an unknown, expired or malformed key or token |
| 403 | `ForbiddenException` | OAuth token without the needed scope, or used on a non-GET request; an action the event type disables |
| 404 | `NotFoundException` | The resource doesn't exist or isn't yours (other users' resources are reported as missing) |
| 409 | `ConflictException` | The slot is taken, the booking is already cancelled, a slug or webhook URL is taken |
| 429 | `ThrottlerException` | The API key made more than 120 requests in a minute |
| 500 | `InternalServerErrorException` | Unexpected server error |

Validation messages list each problem as `<field path> - <message>`, separated by commas, with
`body` for the whole object:

```
"timeZone - Required, isDefault - Required"
"body - Unrecognized key(s) in object: 'email'"
```

Other messages are the app's English text, e.g. `"Booking not found"` or `"This URL is already taken"`.

## Endpoints

"Key" means an API key or an OAuth token with the listed scope; "Key only" means OAuth tokens get 403.
"Optional" endpoints are public and use the key's owner when one is sent.

| Method | Path | Auth | OAuth scope | Purpose |
| --- | --- | --- | --- | --- |
| GET | [`/me`](references/authentication.md#get-me) | Key | READ_PROFILE | The key owner's profile |
| PATCH | [`/me`](references/authentication.md#patch-me) | Key only | – | Update name, bio, avatar, time format, week start, time zone, locale, default schedule |
| GET | [`/event-types`](references/event-types.md#list-event-types) | Optional | READ_PROFILE | Your event types, or another user's public ones with `?username=` |
| POST | [`/event-types`](references/event-types.md#create-an-event-type) | Key only | – | Create an event type |
| GET | [`/event-types/{eventTypeId}`](references/event-types.md#get-an-event-type) | Key | READ_PROFILE | One of your event types |
| PATCH | [`/event-types/{eventTypeId}`](references/event-types.md#update-an-event-type) | Key only | – | Change an event type's settings |
| DELETE | [`/event-types/{eventTypeId}`](references/event-types.md#delete-an-event-type) | Key only | – | Delete an event type |
| GET | [`/schedules`](references/schedules.md#list-schedules) | Key | READ_PROFILE | All your availability schedules |
| POST | [`/schedules`](references/schedules.md#create-a-schedule) | Key only | – | Create a schedule |
| GET | [`/schedules/default`](references/schedules.md#get-the-default-schedule) | Key | READ_PROFILE | Your default schedule |
| GET | [`/schedules/{scheduleId}`](references/schedules.md#get-a-schedule) | Key | READ_PROFILE | One schedule |
| PATCH | [`/schedules/{scheduleId}`](references/schedules.md#update-a-schedule) | Key only | – | Change a schedule, or make it the default |
| DELETE | [`/schedules/{scheduleId}`](references/schedules.md#delete-a-schedule) | Key only | – | Delete a schedule that isn't the default |
| GET | [`/slots`](references/slots.md) | Optional | READ_PROFILE | Bookable start times for an event type |
| GET | [`/bookings`](references/bookings.md#list-bookings) | Key | READ_BOOKING | Bookings you host or attend, filtered, sorted and paginated |
| POST | [`/bookings`](references/bookings.md#create-a-booking) | Optional | – | Book an event type (single, recurring or seated) |
| GET | [`/bookings/{bookingUid}`](references/bookings.md#get-a-booking) | Optional | READ_BOOKING | One booking, by its uid |
| POST | [`/bookings/{bookingUid}/cancel`](references/bookings.md#cancel-a-booking) | Optional | – | Cancel as the host (with your key) or as an attendee |
| POST | [`/bookings/{bookingUid}/reschedule`](references/bookings.md#reschedule-a-booking) | Optional | – | Move a booking to a new start time |
| POST | [`/bookings/{bookingUid}/confirm`](references/bookings.md#confirm-or-decline-a-booking) | Key only (host) | – | Accept a booking that needs confirmation |
| POST | [`/bookings/{bookingUid}/decline`](references/bookings.md#confirm-or-decline-a-booking) | Key only (host) | – | Reject a booking that needs confirmation |
| POST | [`/bookings/{bookingUid}/mark-absent`](references/bookings.md#mark-attendees-absent) | Key only (host) | – | Record attendee no-shows |
| POST | [`/bookings/{bookingUid}/guests`](references/bookings.md#add-guests) | Key only (host) | – | Add guests |
| PATCH | [`/bookings/{bookingUid}/location`](references/bookings.md#change-the-location) | Key only (host) | – | Change the meeting location |
| GET | [`/webhooks`](references/webhooks.md#list-webhooks) | Key | READ_PROFILE | Your webhooks |
| POST | [`/webhooks`](references/webhooks.md#create-a-webhook) | Key only | – | Subscribe a URL to booking events |
| GET | [`/webhooks/{webhookId}`](references/webhooks.md#get-a-webhook) | Key | READ_PROFILE | One webhook |
| PATCH | [`/webhooks/{webhookId}`](references/webhooks.md#update-a-webhook) | Key only | – | Change a webhook |
| DELETE | [`/webhooks/{webhookId}`](references/webhooks.md#delete-a-webhook) | Key only | – | Delete a webhook |

Webhook deliveries (payload format and the `X-Cal-Signature-256` signature) are described in
[references/webhooks.md](references/webhooks.md#deliveries).

## Not available here

These parts of Cal.com's API v2 are not served by Cal.diy. Don't call them:

- Calendars: connections, busy times, destination and selected calendars, ICS feeds
- Conferencing apps, Stripe and other app endpoints
- Teams and organizations (memberships, team event types, team schedules, attributes, routing forms)
- Platform: OAuth clients (`x-cal-client-id` / `x-cal-secret-key`), managed users, webhooks per OAuth client
- Event type sub-resources: per-event-type webhooks, private links
- Slot reservations (`/slots/reservations`) and the older `/slots/available`
- Bookings: reassign, references, recordings, transcripts, calendar links, the `/bookings/{uid}/no-show` path (use `mark-absent`)
- Out of office entries, users, `/timezones`, `/provider/...`, `/api-keys/refresh`, verified resources
- Other `cal-api-version` values for the versioned endpoints

## Quick start

```bash
CAL_API_URL=http://localhost:3000/api/v2
CAL_API_KEY=cal_0123456789abcdef0123456789abcdef

# 1. Find the event type
curl "$CAL_API_URL/event-types" \
  -H "Authorization: Bearer $CAL_API_KEY" -H "cal-api-version: 2024-06-14"

# 2. Look up free times (public)
curl "$CAL_API_URL/slots?eventTypeId=3&start=2026-11-02&end=2026-11-06&timeZone=Europe/London" \
  -H "cal-api-version: 2024-09-04"

# 3. Book one of them (public)
curl -X POST "$CAL_API_URL/bookings" \
  -H "cal-api-version: 2024-08-13" -H "Content-Type: application/json" \
  -d '{"start":"2026-11-02T09:00:00.000Z","eventTypeId":3,
       "attendee":{"name":"Bob Booker","email":"bob@example.com","timeZone":"America/New_York"}}'

# 4. Get notified about changes
curl -X POST "$CAL_API_URL/webhooks" \
  -H "Authorization: Bearer $CAL_API_KEY" -H "Content-Type: application/json" \
  -d '{"subscriberUrl":"https://example.com/cal-hook","triggers":["BOOKING_CREATED","BOOKING_CANCELLED"],"active":true,"secret":"whsec_test"}'
```

## Tips

- Store each booking's `uid`. Every booking action takes it, and anyone holding it can read,
  cancel or reschedule the booking.
- Only book start times returned by `/slots`. Anything else answers 409.
- Send times as ISO 8601 with an offset or `Z`. Bookings come back in UTC; slots come back in the
  requested `timeZone`.
- On 429, wait and retry with backoff.
