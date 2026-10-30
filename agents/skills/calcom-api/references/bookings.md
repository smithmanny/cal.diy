# Bookings

Every bookings endpoint needs the header `cal-api-version: 2024-08-13`.

Bookings are addressed by `uid`, a random string returned when the booking is made. The uid is the
booking's access token: anyone holding it can read, cancel and reschedule the booking, as from the
links in confirmation emails. Host actions (confirm, decline, mark absent, add guests, change
location) need the host's API key.

## The booking object

Every endpoint here returns bookings in this shape (`BookingOutput_2024_08_13`):

```json
{
  "id": 1,
  "uid": "cmvuwxz6z0001023z1h2s3m6z",
  "title": "Intro call between Ada Host and Bob Booker",
  "description": "Looking forward",
  "hosts": [
    {
      "id": 1,
      "name": "Ada Host",
      "email": "ada@example.com",
      "displayEmail": "ada@example.com",
      "username": "ada",
      "timeZone": "Europe/London"
    }
  ],
  "status": "accepted",
  "start": "2026-11-02T09:00:00.000Z",
  "end": "2026-11-02T09:30:00.000Z",
  "duration": 30,
  "eventTypeId": 3,
  "eventType": { "id": 3, "slug": "intro" },
  "meetingUrl": "https://example.com/room",
  "location": "https://example.com/room",
  "absentHost": false,
  "createdAt": "2026-10-30T11:53:00.780Z",
  "updatedAt": "2026-10-30T11:53:00.780Z",
  "metadata": {},
  "icsUid": "cmvuwxz6z0001023z1h2s3m6z@cal.diy",
  "attendees": [
    {
      "name": "Bob Booker",
      "email": "bob@example.com",
      "displayEmail": "bob@example.com",
      "timeZone": "America/New_York",
      "language": "en",
      "absent": false
    },
    {
      "name": "",
      "email": "carol@example.com",
      "displayEmail": "carol@example.com",
      "timeZone": "America/New_York",
      "language": "en",
      "absent": false
    }
  ],
  "guests": ["carol@example.com"],
  "bookingFieldsResponses": {
    "name": "Bob Booker",
    "email": "bob@example.com",
    "location": { "value": "link", "optionValue": "" },
    "notes": "Looking forward",
    "guests": ["carol@example.com"]
  }
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | |
| `uid` | string | |
| `title` | string | |
| `description` | string | `""` when empty |
| `hosts` | array | The organizer: `id`, `name`, `email`, `displayEmail`, `username`, `timeZone`. Empty if the booking has no organizer |
| `status` | string | `accepted`, `pending` (awaiting confirmation), `cancelled`, `rejected`, `awaiting_host` |
| `cancellationReason` | string | Only when set. For a declined booking, the decline reason |
| `cancelledByEmail` | string | Only when known (set when the host cancels) |
| `reschedulingReason` | string | Only when given |
| `rescheduledByEmail` | string | Only when set |
| `rescheduledFromUid` | string | On the new booking after a reschedule |
| `rescheduledToUid` | string | On the old (cancelled) booking after a reschedule |
| `recurringBookingUid` | string | Shared by every occurrence of a recurring booking |
| `start`, `end` | string | ISO 8601, UTC |
| `duration` | number | Minutes |
| `eventTypeId` | number or null | |
| `eventType` | object or null | `{ id, slug }` |
| `meetingUrl` | string | Only when `location` is an `http(s)` URL |
| `location` | string | Address, URL or phone number; `""` when none |
| `absentHost` | boolean | |
| `createdAt` | string | ISO 8601 |
| `updatedAt` | string or null | ISO 8601 |
| `metadata` | object | String values only |
| `rating` | number | Only when rated |
| `icsUid` | string | Only when set; the calendar invite's UID |
| `attendees` | array | `name`, `email`, `displayEmail`, `timeZone`, `language` (default `"en"`), `absent`, and `phoneNumber` when known. Guests are attendees too |
| `guests` | string[] | Guest emails |
| `bookingFieldsResponses` | object | The booking form answers, keyed by field slug |

---

## Create a booking

`POST /bookings` — **Auth:** optional. Anyone may book, as on the public booking page. With an API
key, the key's owner is recorded as the person who made the booking. OAuth tokens get 403.
Answers **201**.

Name the event type by `eventTypeId`, or by `username` plus `eventTypeSlug`. Team event types
can't be booked by `eventTypeId` (404 `Event type not found`).

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `start` | string | yes | ISO 8601 date-time with `Z` or an offset. Must be a start time `/slots` offers |
| `attendee.name` | string | yes | Trimmed, 1-200 characters |
| `attendee.email` | string | yes | Email, up to 320 characters |
| `attendee.timeZone` | string | yes | 1-100 characters, a valid IANA time zone |
| `attendee.phoneNumber` | string | no | Up to 30 characters. Stored only if the event's phone field is shown |
| `attendee.language` | string | no | Up to 20 characters; default `"en"` |
| `eventTypeId` | number | one of | Positive integer |
| `eventTypeSlug` | string | one of | 1-200 characters, with `username` |
| `username` | string | one of | 1-100 characters, with `eventTypeSlug` |
| `guests` | string[] | no | Up to 30 emails |
| `location` | object | no | See below |
| `bookingFieldsResponses` | object | no | Answers to the event's other booking questions, keyed by field slug (e.g. `notes`, `title`, custom fields) |
| `lengthInMinutes` | number | no | 1-1440. Must be one of the event's `lengthInMinutesOptions` (or its length) |
| `recurrenceCount` | number | no | 1-100. For recurring event types: book fewer occurrences than the event offers. Ignored otherwise |
| `emailVerificationCode` | string | no | Six digits. Required when the event type has `requiresBookerEmailVerification` |

Other fields are ignored. `attendee.name`, `attendee.email`, `guests`, `location` and
`attendee.phoneNumber` override the same keys in `bookingFieldsResponses`.

`location` picks one of the event type's locations:

| `location` | Picks |
| --- | --- |
| `{ "type": "address" }` | The event's in-person address |
| `{ "type": "link" }` | The event's link |
| `{ "type": "phone" }` | The host's phone number |
| `{ "type": "attendeePhone", "phone": "+15551234567" }` | The attendee's phone (1-30 characters) |
| `{ "type": "integration", "integration": "google-meet" }` | Google Meet |

Without `location`, an event type with a single location uses it.

```bash
curl -X POST http://localhost:3000/api/v2/bookings \
  -H "cal-api-version: 2024-08-13" \
  -H "Content-Type: application/json" \
  -d '{
    "start": "2026-11-02T09:00:00Z",
    "eventTypeId": 3,
    "attendee": { "name": "Bob Booker", "email": "bob@example.com", "timeZone": "America/New_York", "language": "en" },
    "guests": ["carol@example.com"],
    "bookingFieldsResponses": { "notes": "Looking forward" }
  }'
```

The response is the booking object above, with:

- `status: "pending"` when the event type needs confirmation.
- For a **recurring** event type, `data` is an **array** with every occurrence, earliest first, all
  sharing `recurringBookingUid`.
- For a **seated** event type, the booking object plus `seatUid`, the booker's seat. Keep it to
  cancel or move just that seat.

Errors:

| Status | Message | When |
| --- | --- | --- |
| 400 | `eventTypeId - Provide eventTypeId, or eventTypeSlug and username` | No event type given |
| 400 | `attendee.email - Invalid email`, etc. | Validation |
| 400 | `Please choose a valid time zone` | Bad `attendee.timeZone` |
| 400 | `This event can't be booked for that length of time` | `lengthInMinutes` not offered |
| 400 | `Something went wrong.` | `recurrenceCount` above the event's occurrences |
| 400 | `Email verification is required for this event type` | Missing `emailVerificationCode` |
| 400 | The form's message, e.g. for a required question | A required booking field is missing or invalid |
| 404 | `Event type not found` / `User not found` | Unknown event type or username |
| 409 | `This slot is no longer available. Please return to the previous page and select another time.` | `start` isn't a free slot |
| 409 | `You've reached the limit of N upcoming bookings for this event type` | Booker limit reached |

There is no API endpoint for sending email verification codes; the booker gets one from the
booking page.

---

## List bookings

`GET /bookings` — **Auth:** API key, or OAuth with `READ_BOOKING`. Lists bookings you host and
bookings where your email is an attendee. Paginated.

| Query | Type | Notes |
| --- | --- | --- |
| `status` | comma list | `upcoming`, `recurring`, `past`, `cancelled`, `unconfirmed`. Several are OR'ed: `status=upcoming,past` |
| `attendeeEmail` | string | Exact email, case-insensitive |
| `attendeeName` | string | 1-200 characters; substring, case-insensitive |
| `bookingUid` | string | 1-100 characters |
| `eventTypeIds` | comma list | Positive integers |
| `eventTypeId` | number | Positive integer; combined with `eventTypeIds` |
| `afterStart` | date-time | `start >= afterStart` |
| `beforeEnd` | date-time | `end <= beforeEnd` |
| `afterCreatedAt`, `beforeCreatedAt` | date-time | |
| `afterUpdatedAt`, `beforeUpdatedAt` | date-time | |
| `sortStart`, `sortEnd`, `sortCreated`, `sortUpdatedAt` | `asc` or `desc` | Only the first one given is used, in this order. Default: start time ascending |
| `take` | number | 1-250, default 100 |
| `skip` | number | 0 or more, default 0 |

Date-times are ISO 8601 with `Z` or an offset.

What each status matches:

| Status | Bookings |
| --- | --- |
| `upcoming` | Not yet ended, not cancelled or rejected. Occurrences of a recurring booking only once accepted |
| `recurring` | Not yet ended, part of a recurring booking, not cancelled or rejected |
| `past` | Ended, not cancelled or rejected |
| `cancelled` | Cancelled or rejected |
| `unconfirmed` | Not yet ended, pending confirmation |

```bash
curl "http://localhost:3000/api/v2/bookings?status=upcoming&attendeeName=bob&take=10" \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-08-13"
```

```json
{
  "status": "success",
  "data": [ { "id": 1, "uid": "cmvuwxz6z0001023z1h2s3m6z", "status": "accepted", "...": "..." } ],
  "pagination": {
    "totalItems": 1,
    "remainingItems": 0,
    "returnedItems": 1,
    "itemsPerPage": 10,
    "currentPage": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Errors: 401 without credentials; 400 for an unknown status
(`status.0 - Invalid enum value. Expected 'upcoming' | 'recurring' | 'past' | 'cancelled' | 'unconfirmed', received 'bogus'`)
or an out-of-range `take` (`take - Number must be less than or equal to 250`).

---

## Get a booking

`GET /bookings/{bookingUid}` — **Auth:** optional (OAuth needs `READ_BOOKING`). Returns the
booking object.

```bash
curl http://localhost:3000/api/v2/bookings/cmvuwxz6z0001023z1h2s3m6z \
  -H "cal-api-version: 2024-08-13"
```

Errors: 404 `Booking not found`.

---

## Cancel a booking

`POST /bookings/{bookingUid}/cancel` — **Auth:** optional. Returns the cancelled booking.

| Field | Type | Constraints |
| --- | --- | --- |
| `cancellationReason` | string | Up to 1000 characters |
| `cancelSubsequentBookings` | boolean | Host only: for a recurring booking, also cancel the occurrences that haven't started |
| `seatUid` | string | 1-100 characters. Gives up only that seat of a seated booking |

Who cancels depends on the credentials:

- **The host's API key**: cancels as the host. `cancelledByEmail` is set to the host's email. Only
  this occurrence, unless `cancelSubsequentBookings` is `true`.
- **Anyone else** (no key, or another user's key): cancels as an attendee would. With `seatUid`,
  only that seat is released. Without it, the booking is cancelled, and for a recurring booking so
  is every occurrence that hasn't started.

```bash
curl -X POST http://localhost:3000/api/v2/bookings/cmvuwy62t00025m2s5a3z2m6j/cancel \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-08-13" \
  -H "Content-Type: application/json" \
  -d '{"cancellationReason":"No longer needed"}'
```

```json
{
  "status": "success",
  "data": {
    "uid": "cmvuwy62t00025m2s5a3z2m6j",
    "status": "cancelled",
    "cancellationReason": "No longer needed",
    "cancelledByEmail": "ada@example.com",
    "...": "..."
  }
}
```

Errors:

| Status | Message | When |
| --- | --- | --- |
| 403 | `You cannot cancel this booking` | The event type disables cancelling |
| 404 | `Booking not found` | Unknown uid or `seatUid` |
| 409 | `This event is canceled` | Already cancelled or rejected |

---

## Reschedule a booking

`POST /bookings/{bookingUid}/reschedule` — **Auth:** optional. Books the new time with the original
answers and length, and cancels the old booking. Answers **201** with the **new** booking, whose
`rescheduledFromUid` is the old uid. The old booking then has `status: "cancelled"` and
`rescheduledToUid`.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `start` | string | yes | ISO 8601 date-time with `Z` or an offset; must be a free slot |
| `reschedulingReason` | string | no | Up to 1000 characters |
| `rescheduledBy` | string | no | Email. Accepted but not stored |
| `seatUid` | string | no | 1-100 characters. Required for a seated booking: moves that seat |

With the host's API key, the minimum reschedule notice doesn't apply.

```bash
curl -X POST http://localhost:3000/api/v2/bookings/cmvuwxz6z0001023z1h2s3m6z/reschedule \
  -H "cal-api-version: 2024-08-13" \
  -H "Content-Type: application/json" \
  -d '{"start":"2026-11-02T10:00:00Z","reschedulingReason":"Clash"}'
```

```json
{
  "status": "success",
  "data": {
    "id": 2,
    "uid": "cmvuwy62t00025m2s5a3z2m6j",
    "status": "accepted",
    "reschedulingReason": "Clash",
    "rescheduledFromUid": "cmvuwxz6z0001023z1h2s3m6z",
    "start": "2026-11-02T10:00:00.000Z",
    "end": "2026-11-02T10:30:00.000Z",
    "...": "..."
  }
}
```

Errors:

| Status | Message | When |
| --- | --- | --- |
| 403 | `Rescheduling is disabled for this event` | The event type disables rescheduling |
| 403 | `Rescheduling is disabled within the minimum notice period before the event` | Too close to the start (not for the host) |
| 404 | `Booking not found` | Unknown uid, booking without an event type, or a seated booking without a valid `seatUid` |
| 404 | `Event type not found` | The event type's owner has no username |
| 409 | `This event is canceled` | Already cancelled or rejected (except after the host asked for a new time) |
| 409 | `This slot is no longer available. ...` | `start` isn't free |

---

## Confirm or decline a booking

`POST /bookings/{bookingUid}/confirm` and `POST /bookings/{bookingUid}/decline` — **Auth:** the
host's API key. For bookings with `status: "pending"`. A recurring request is confirmed or declined
as a whole.

`confirm` takes no body. `decline` takes:

| Field | Type | Constraints |
| --- | --- | --- |
| `reason` | string | Optional, up to 1000 characters. Returned as `cancellationReason` |

```bash
curl -X POST http://localhost:3000/api/v2/bookings/cmvuwykfo00032d293m5w2q62/decline \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-08-13" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Fully booked"}'
```

```json
{
  "status": "success",
  "data": { "uid": "cmvuwykfo00032d293m5w2q62", "status": "rejected", "cancellationReason": "Fully booked", "...": "..." }
}
```

`confirm` returns the booking with `status: "accepted"`.

Errors: 401 without a key; 404 `Booking not found` if you aren't the host; 409
`Something went wrong.` if the booking isn't pending.

---

## Mark attendees absent

`POST /bookings/{bookingUid}/mark-absent` — **Auth:** the host's API key. Returns the booking;
each attendee's `absent` reflects the change.

| Field | Type | Constraints |
| --- | --- | --- |
| `attendees` | array | Up to 100 of `{ "email": string, "absent": boolean }` |
| `host` | boolean | Only `false` or omitted. `true` answers 400 (`host - marking the host absent is not supported`) |

```bash
curl -X POST http://localhost:3000/api/v2/bookings/cmvuwy62t00025m2s5a3z2m6j/mark-absent \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-08-13" \
  -H "Content-Type: application/json" \
  -d '{"attendees":[{"email":"bob@example.com","absent":true}]}'
```

Errors: 400 `You can only mark no-shows once the booking has started`; 404 `Booking not found` if
you aren't the host.

---

## Add guests

`POST /bookings/{bookingUid}/guests` — **Auth:** the host's API key. Returns the booking with the
new attendees. New guests get a confirmation email; the others an update.

| Field | Type | Constraints |
| --- | --- | --- |
| `guests` | array | 1-30 objects |
| `guests[].email` | string | Required, email, up to 320 characters |
| `guests[].name`, `timeZone`, `phoneNumber`, `language` | string | Accepted but ignored: guests get an empty name and the host's time zone and language |

```bash
curl -X POST http://localhost:3000/api/v2/bookings/cmvuwy62t00025m2s5a3z2m6j/guests \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-08-13" \
  -H "Content-Type: application/json" \
  -d '{"guests":[{"email":"dan@example.com"}]}'
```

Errors:

| Status | Message | When |
| --- | --- | --- |
| 400 | `Emails must be unique and valid` | Every email is already on the booking |
| 403 | `This event type doesn't allow guests` | Guests are disabled |
| 404 | `Booking not found` | Not your booking |
| 409 | `This event is canceled` / `This booking has already ended` | |

---

## Change the location

`PATCH /bookings/{bookingUid}/location` — **Auth:** the host's API key. Returns the booking with
the new `location`.

| `location` | Constraints |
| --- | --- |
| `{ "type": "address", "address": "1 Infinite Loop" }` | `address`: trimmed, 1-500 characters |
| `{ "type": "link", "link": "https://example.com/room" }` | `link`: URL, up to 2000 characters |
| `{ "type": "phone", "phone": "+15550001111" }` | `phone`: trimmed, 6-20 characters |
| `{ "type": "integration", "integration": "google-meet" }` | |

```bash
curl -X PATCH http://localhost:3000/api/v2/bookings/cmvuwy62t00025m2s5a3z2m6j/location \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-08-13" \
  -H "Content-Type: application/json" \
  -d '{"location":{"type":"address","address":"1 Infinite Loop"}}'
```

Errors: 400 for any other `type`; 404 `Booking not found` if you aren't the host; 409
`This event is canceled` or `This booking has already ended`.
