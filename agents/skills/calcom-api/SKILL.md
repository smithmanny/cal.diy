---
name: calcom-api
description: Interact with a Cal.diy instance's API v2 to manage bookings, event types, schedules, slots and webhooks. Use this skill when building integrations that need to create or manage bookings, check availability, configure event types, or receive booking webhooks from a self-hosted Cal.diy.
env:
  CAL_API_URL:
    description: "Base URL of the Cal.diy instance's API, e.g. https://cal.example.com/api/v2."
    required: true
  CAL_API_KEY:
    description: "Cal.diy API key (starts with cal_), created under Settings > Developer > API keys. Required for authenticated requests."
    required: true
  CAL_WEBHOOK_SECRET:
    description: "Secret used to verify webhook payload signatures via the X-Cal-Signature-256 header."
    required: false
---

# Cal.diy API v2

Cal.diy is self-hosted, so there is no shared API host: every instance serves its own API under
`/api/v2`. It implements a subset of Cal.com's API v2 with the same paths, request and response
shapes and `cal-api-version` headers, so code written for Cal.com's API works for these endpoints.

## Base URL

```
https://<your-cal-diy-host>/api/v2
```

## Required Credentials

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `CAL_API_URL` | Yes | The instance's API base, e.g. `https://cal.example.com/api/v2` |
| `CAL_API_KEY` | Yes | API key starting with `cal_`, created under Settings > Developer > API keys. Sent as a Bearer token |
| `CAL_WEBHOOK_SECRET` | No | Secret for verifying webhook signatures in the `X-Cal-Signature-256` header |

## Authentication

```
Authorization: Bearer cal_<your_api_key>
```

The key acts as its owner. Keys are limited to 120 requests a minute. Instead of a key, a third-party
app can use an access token from the instance's OAuth provider, for reading only. See
`references/authentication.md`.

## What this instance serves

| Endpoint | `cal-api-version` | Auth |
| --- | --- | --- |
| `GET`, `PATCH /me` | – | key |
| `GET /event-types` (yours, or `?username=`[`&eventSlug=`] publicly), `POST /event-types` | 2024-06-14 | key / optional |
| `GET`, `PATCH`, `DELETE /event-types/{id}` | 2024-06-14 | key |
| `GET`, `POST /schedules`, `GET /schedules/default`, `GET`, `PATCH`, `DELETE /schedules/{id}` | 2024-06-11 | key |
| `GET /slots` (by `eventTypeId`, or `username` + `eventTypeSlug`; `format=range`) | 2024-09-04 | optional |
| `POST /bookings` (single, recurring, seated), `GET /bookings/{uid}` | 2024-08-13 | optional |
| `GET /bookings` (filters, sorting, `take`/`skip`) | 2024-08-13 | key |
| `POST /bookings/{uid}/cancel`, `/reschedule` | 2024-08-13 | optional (the host's key cancels as host) |
| `POST /bookings/{uid}/confirm`, `/decline`, `/mark-absent`, `/guests`; `PATCH /bookings/{uid}/location` | 2024-08-13 | key (host) |
| `GET`, `POST /webhooks`, `GET`, `PATCH`, `DELETE /webhooks/{id}` | – | key |

Endpoints that need a version answer 400 without the right `cal-api-version` header. Not served:
calendars and busy times, conferencing, slot reservations, teams and organizations, platform OAuth
clients and managed users (`x-cal-client-id` / `x-cal-secret-key`), booking reassign and references,
API key refresh. The reference files describe Cal.com's API; each one starts with what Cal.diy serves.

## Core Concepts

**Event Types** define bookable meeting configurations (duration, location, availability rules). Each event type has a slug used in booking URLs.

**Bookings** are appointments created when someone books an event type. Each booking has a unique UID.

**Schedules** define when a user is available. Users can have several schedules with different working hours.

**Slots** are the available times that can be booked, given the event type and the host's availability.

## Reference Documentation

| Reference | Description |
|-----------|-------------|
| `references/authentication.md` | API keys, OAuth access tokens, versioning, errors, pagination |
| `references/bookings.md` | Create, list, cancel, reschedule bookings |
| `references/event-types.md` | Configure bookable meeting types |
| `references/schedules.md` | Manage availability schedules |
| `references/slots-availability.md` | Query available time slots |
| `references/webhooks.md` | Booking event notifications |

## Quick Start

### 1. Check Available Slots

```http
GET /api/v2/slots?start=2024-01-15&end=2024-01-22&eventTypeId=123
cal-api-version: 2024-09-04
```

See `references/slots-availability.md` for full details.

### 2. Create a Booking

```http
POST /api/v2/bookings
Content-Type: application/json
cal-api-version: 2024-08-13

{
  "start": "2024-01-15T10:00:00Z",
  "eventTypeId": 123,
  "attendee": {
    "name": "John Doe",
    "email": "john@example.com",
    "timeZone": "America/New_York"
  }
}
```

See `references/bookings.md` for all booking operations.

### 3. Set Up Webhooks

```http
POST /api/v2/webhooks
Authorization: Bearer cal_<your_api_key>
Content-Type: application/json

{
  "subscriberUrl": "https://your-app.com/webhook",
  "triggers": ["BOOKING_CREATED", "BOOKING_CANCELLED"]
}
```

Triggers this instance sends: `BOOKING_CREATED`, `BOOKING_REQUESTED`, `BOOKING_RESCHEDULED`,
`BOOKING_CANCELLED`, `BOOKING_REJECTED`, `BOOKING_NO_SHOW_UPDATED`. See `references/webhooks.md`.

## Common Workflows

**Book a meeting**: Check slots -> Create booking -> Store booking UID

**Reschedule**: Get new slots -> `POST /api/v2/bookings/{uid}/reschedule`

**Cancel**: `POST /api/v2/bookings/{uid}/cancel` with an optional reason

## Best Practices

1. Always check slot availability before creating bookings
2. Store booking UIDs for later operations (cancel, reschedule)
3. Use ISO 8601 for all timestamps
4. Send the `cal-api-version` each endpoint expects
5. Handle `429` responses (rate limiting) with exponential backoff

## Additional Resources

- Endpoint list and behavior: `MIGRATION.md` ("API v2") in the Cal.diy repository
- Cal.com's full API v2 spec (a superset): `docs/api-reference/v2/openapi.json` in the repository
