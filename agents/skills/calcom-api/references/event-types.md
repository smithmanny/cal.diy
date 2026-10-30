# Event types

Every event types endpoint needs the header `cal-api-version: 2024-06-14`.

An event type is something people can book, at `<your Cal.diy URL>/<username>/<slug>`.

## The event type object

All endpoints except `DELETE` return event types in this shape (`EventTypeOutput_2024_06_14`).
Settings that are off are left out of the object (see the notes).

```json
{
  "id": 3,
  "ownerId": 1,
  "lengthInMinutes": 30,
  "lengthInMinutesOptions": [15, 30, 60],
  "title": "Intro call",
  "slug": "intro",
  "description": "A first chat",
  "locations": [{ "type": "link", "link": "https://example.com/room", "public": true }],
  "bookingFields": [
    { "type": "name", "slug": "name", "label": "your_name", "required": true, "hidden": false, "isDefault": true },
    { "type": "email", "slug": "email", "label": "email_address", "required": true, "hidden": false, "isDefault": true },
    { "type": "textarea", "slug": "notes", "label": "additional_notes", "placeholder": "share_additional_notes", "required": false, "hidden": false, "isDefault": true }
  ],
  "disableGuests": false,
  "slotInterval": null,
  "minimumBookingNotice": 0,
  "beforeEventBuffer": 0,
  "afterEventBuffer": 0,
  "recurrence": null,
  "metadata": {},
  "price": 0,
  "currency": "usd",
  "lockTimeZoneToggleOnBookingPage": false,
  "seatsPerTimeSlot": null,
  "forwardParamsSuccessRedirect": true,
  "successRedirectUrl": null,
  "isInstantEvent": false,
  "seatsShowAvailabilityCount": true,
  "scheduleId": null,
  "onlyShowFirstAvailableSlot": false,
  "requiresBookerEmailVerification": false,
  "hideCalendarNotes": false,
  "offsetStart": 0,
  "hideCalendarEventDetails": false,
  "hideOrganizerEmail": false,
  "hidden": false,
  "bookingRequiresAuthentication": false,
  "disableCancelling": { "disabled": false },
  "disableRescheduling": { "disabled": false, "minutesBefore": 60 },
  "interfaceLanguage": null,
  "bookingLimitsCount": { "day": 3, "disabled": false },
  "bookingWindow": { "type": "calendarDays", "value": 30, "rolling": false, "disabled": false },
  "bookerLayouts": { "enabledLayouts": ["month_view", "week_view"], "defaultLayout": "month_view" },
  "color": { "lightThemeHex": "#292929", "darkThemeHex": "#fafafa" },
  "seats": { "disabled": true },
  "users": [
    {
      "id": 1,
      "name": "Ada Host",
      "username": "ada",
      "avatarUrl": null,
      "weekStart": "Sunday",
      "brandColor": null,
      "darkBrandColor": null,
      "metadata": {}
    }
  ],
  "bookingUrl": "http://localhost:3000/ada/intro"
}
```

Notes on the output:

- `lengthInMinutesOptions` appears only when several lengths are offered; `customName` only when set.
- `bookingLimitsCount`, `bookingLimitsDuration`, `bookerActiveBookingsLimit`, `bookingWindow`,
  `bookerLayouts`, `confirmationPolicy` and `color` appear only when set. `seats` is
  `{ "disabled": true }` when the event isn't seated.
- `bookerLayouts` values come back as `month_view`, `week_view` and `column_view`, while input takes
  `month`, `week` and `column`.
- `bookingFields[].label` and `placeholder` are the field's own text, or a translation key such as
  `your_name` for built-in fields. `options` lists the values of select-type fields. The location
  question has `type: "radioInput"`.
- `price` (0), `currency` (`"usd"`), `metadata` (`{}`), `isInstantEvent` (false) and
  `bookingRequiresAuthentication` (false) are always these values.
- `locations[]` come back as `address`, `link`, `phone` (with `public: true`), `attendeePhone`
  or `integration` (`google-meet`).
- `users` holds the owner; `bookingUrl` is built from the request's origin.

---

## List event types

`GET /event-types` — **Auth:** optional (OAuth needs `READ_PROFILE`).

| Query | Type | Notes |
| --- | --- | --- |
| `username` | string | 1-100 characters. That user's event types that are shown on their booking page (hidden ones are left out). No auth needed |
| `eventSlug` | string | 1-200 characters. Keep only the event type with this slug |

Without `username` you need a key, and you get all of your own event types, hidden ones included.
An unknown username returns an empty list.

```bash
# Yours
curl http://localhost:3000/api/v2/event-types \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-14"

# Someone's public event type
curl "http://localhost:3000/api/v2/event-types?username=ada&eventSlug=intro" \
  -H "cal-api-version: 2024-06-14"
```

```json
{ "status": "success", "data": [ { "id": 3, "slug": "intro", "...": "..." } ] }
```

Errors: 401 without `username` and without a key.

---

## Get an event type

`GET /event-types/{eventTypeId}` — **Auth:** API key, or OAuth with `READ_PROFILE`. Only your own
event types.

```bash
curl http://localhost:3000/api/v2/event-types/3 \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-14"
```

Errors: 400 `eventTypeId must be a positive integer.`; 404 `Not found` (unknown or not yours).

---

## Create an event type

`POST /event-types` — **Auth:** API key only. Answers **201** with the event type.

`title`, `slug` and `lengthInMinutes` are required; every other field below is optional. Unknown
fields are rejected (`body - Unrecognized key(s) in object: 'price'`). If any setting fails
validation, nothing is created.

The slug is normalized (lowercased, spaces to dashes) and must be unused among your event types.

## Update an event type

`PATCH /event-types/{eventTypeId}` — **Auth:** API key only. Same fields as create, all optional.
Fields you leave out keep their value. Returns the updated event type.

### Fields

| Field | Type | Constraints |
| --- | --- | --- |
| `title` | string | Trimmed, 1-200 characters |
| `slug` | string | Trimmed, 1-200 characters |
| `lengthInMinutes` | number | Integer, 1-1440 |
| `lengthInMinutesOptions` | number[] | 1-30 integers, each 1-1440. Lengths the booker can choose |
| `description` | string | Up to 5000 characters |
| `locations` | array | Up to 10; see below |
| `slotInterval` | number or null | Integer, 1-1440. Minutes between start times; null uses the length |
| `minimumBookingNotice` | number | Minutes, 0-525600 |
| `beforeEventBuffer`, `afterEventBuffer` | number | Minutes, 0-1440 |
| `scheduleId` | number or null | One of your schedules; null uses your default |
| `hidden` | boolean | Hide from your booking page |
| `recurrence` | object | `{ "frequency": "yearly" \| "monthly" \| "weekly", "interval": int >= 1, "occurrences": int >= 1 }` or `{ "disabled": true }` |
| `bookingLimitsCount` | object | Max bookings per period: `{ "day"?, "week"?, "month"?, "year"? }` (integers >= 1), or `{ "disabled": true }` |
| `bookingLimitsDuration` | object | Max booked minutes per period, same shape |
| `bookerActiveBookingsLimit` | object | `{ "maximumActiveBookings": int >= 1, "offerReschedule"?: boolean }` or `{ "disabled": true }` |
| `onlyShowFirstAvailableSlot` | boolean | |
| `bookingWindow` | object | See below |
| `bookerLayouts` | object | `{ "defaultLayout": "month" \| "week" \| "column", "enabledLayouts": [at least one of those] }` |
| `confirmationPolicy` | object | See below |
| `requiresBookerEmailVerification` | boolean | |
| `hideCalendarNotes` | boolean | |
| `hideCalendarEventDetails` | boolean | |
| `hideOrganizerEmail` | boolean | |
| `lockTimeZoneToggleOnBookingPage` | boolean | |
| `color` | object | `{ "lightThemeHex": string, "darkThemeHex": string }` |
| `seats` | object | `{ "seatsPerTimeSlot": int >= 1, "showAttendeeInfo": boolean, "showAvailabilityCount": boolean }` or `{ "disabled": true }` |
| `offsetStart` | number | Minutes, 0-1440. Shifts shown start times |
| `customName` | string | Up to 1000 characters. Booking title template; `""` clears it |
| `successRedirectUrl` | string or null | URL, up to 2000 characters |
| `forwardParamsSuccessRedirect` | boolean | |
| `disableCancelling` | object | `{ "disabled": boolean }` |
| `disableRescheduling` | object | `{ "disabled"?: boolean, "minutesBefore"?: int >= 1 }`. `minutesBefore` blocks rescheduling that close to the start |
| `interfaceLanguage` | string or null | Up to 20 characters |

Send `{ "disabled": true }` on its own to turn a setting off.

**`locations` entries:**

| Entry | Constraints |
| --- | --- |
| `{ "type": "address", "address": string, "public"?: boolean }` | `address`: trimmed, 1-500 characters |
| `{ "type": "link", "link": string, "public"?: boolean }` | `link`: URL, up to 2000 characters |
| `{ "type": "phone", "phone": string, "public"?: boolean }` | The host's number; trimmed, 6-20 characters |
| `{ "type": "attendeePhone" }` | The booker enters a phone number |
| `{ "type": "integration", "integration": "google-meet" }` | |

`public` is accepted but not stored; locations always come back with `public: true`.

**`bookingWindow`:**

| Value | Meaning |
| --- | --- |
| `{ "type": "businessDays" \| "calendarDays", "value": 1-3650, "rolling"?: boolean }` | Bookable up to `value` days ahead. `rolling: true` keeps `value` bookable days open |
| `{ "type": "range", "value": ["2026-11-01", "2026-12-31"] }` | Only between two dates (the first 10 characters of each string are used) |
| `{ "disabled": true }` | No limit |

**`confirmationPolicy`:**

| Value | Meaning |
| --- | --- |
| `{ "type": "always", "blockUnconfirmedBookingsInBooker": boolean }` | Every booking needs the host's confirmation |
| `{ "type": "time", "noticeThreshold": { "unit": "minutes" \| "hours", "count": int >= 1 }, "blockUnconfirmedBookingsInBooker": boolean }` | Only bookings made with less notice than the threshold |
| `{ "disabled": true }` | No confirmation |

`blockUnconfirmedBookingsInBooker: true` keeps pending bookings' times unavailable.

### Examples

```bash
curl -X POST http://localhost:3000/api/v2/event-types \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-14" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Intro call",
    "slug": "intro",
    "lengthInMinutes": 30,
    "lengthInMinutesOptions": [15, 30, 60],
    "description": "A first chat",
    "locations": [{ "type": "link", "link": "https://example.com/room" }],
    "minimumBookingNotice": 0,
    "bookingWindow": { "type": "calendarDays", "value": 30, "rolling": false },
    "bookingLimitsCount": { "day": 3 },
    "bookerLayouts": { "defaultLayout": "month", "enabledLayouts": ["month", "week"] },
    "disableRescheduling": { "disabled": false, "minutesBefore": 60 }
  }'
```

```bash
curl -X PATCH http://localhost:3000/api/v2/event-types/3 \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-14" \
  -H "Content-Type: application/json" \
  -d '{"confirmationPolicy":{"type":"always","blockUnconfirmedBookingsInBooker":false}}'
```

### Errors (create and update)

| Status | Message | When |
| --- | --- | --- |
| 400 | `body - Unrecognized key(s) in object: '<field>'` | A field not in the table |
| 400 | `<field> - <problem>` | Validation, e.g. `bookerLayouts.defaultLayout - Invalid enum value. Expected 'month' \| 'week' \| 'column', received 'month_view'` |
| 400 | `This URL is already taken` | The slug is empty after normalizing |
| 404 | `Not found` | Unknown event type, not yours, or `scheduleId` isn't one of your schedules |
| 409 | `This URL is already taken` | You already have an event type with that slug |

---

## Delete an event type

`DELETE /event-types/{eventTypeId}` — **Auth:** API key only.

```bash
curl -X DELETE http://localhost:3000/api/v2/event-types/4 \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-14"
```

```json
{ "status": "success", "data": { "id": 4, "lengthInMinutes": 20, "title": "Tmp", "slug": "tmp" } }
```

Errors: 404 `Not found`.
