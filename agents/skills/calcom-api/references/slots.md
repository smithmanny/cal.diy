# Slots

`GET /slots` returns the start times that can be booked for an event type. It is public and needs
the header `cal-api-version: 2024-09-04`. With an OAuth token it needs `READ_PROFILE`.

The slots account for the host's schedule, existing bookings, connected calendars' busy times,
buffers, minimum notice, the booking window, booking limits and out-of-office days. Book only the
times returned here; `POST /bookings` rejects anything else with 409.

## Query parameters

| Parameter | Type | Required | Constraints |
| --- | --- | --- | --- |
| `start` | string | yes | `YYYY-MM-DD`, or an ISO 8601 date-time with `Z` or an offset |
| `end` | string | yes | Same formats |
| `eventTypeId` | number | one of | Positive integer |
| `eventTypeSlug` | string | one of | 1-200 characters, with `username` |
| `username` | string | one of | 1-100 characters, with `eventTypeSlug` |
| `timeZone` | string | no | 1-100 characters, a valid IANA time zone. Default `UTC`. Sets the offsets in the output and how days are grouped |
| `duration` | number | no | 1-1440. One of the event's `lengthInMinutesOptions`; also sets the step between start times when the event has no `slotInterval` |
| `format` | string | no | `time` (default) or `range` |
| `bookingUidToReschedule` | string | no | 1-100 characters. Treat that booking's time as free, for rescheduling it |

A bare date means the whole day in UTC: `start=2026-11-02` is `2026-11-02T00:00:00.000Z` and
`end=2026-11-02` is `2026-11-02T23:59:59.999Z`, whatever `timeZone` is. To cover whole days in
another zone, send date-times with that zone's offset. `start` must be before `end`, and the range
can be at most 62 days.

Hidden event types can be queried too. Team event types are not supported by `eventTypeId`
(it answers 404 `Event type not found`).

## Response

`data` maps each day (`YYYY-MM-DD` in `timeZone`) to its slots. Days without slots are left out.

```bash
curl "http://localhost:3000/api/v2/slots?eventTypeId=3&start=2026-11-02&end=2026-11-02&timeZone=America/New_York" \
  -H "cal-api-version: 2024-09-04"
```

```json
{
  "status": "success",
  "data": {
    "2026-11-02": [
      { "start": "2026-11-02T04:00:00.000-05:00" },
      { "start": "2026-11-02T04:30:00.000-05:00" },
      { "start": "2026-11-02T05:00:00.000-05:00" }
    ]
  }
}
```

Times are in `timeZone` with its offset; in `UTC` they end in `Z`.

With `format=range`, each slot also has `end` (start plus `duration`, or the event's length):

```bash
curl "http://localhost:3000/api/v2/slots?username=ada&eventTypeSlug=intro&start=2026-11-02&end=2026-11-03&format=range&duration=60" \
  -H "cal-api-version: 2024-09-04"
```

```json
{
  "status": "success",
  "data": {
    "2026-11-02": [
      { "start": "2026-11-02T09:00:00.000Z", "end": "2026-11-02T10:00:00.000Z" },
      { "start": "2026-11-02T10:00:00.000Z", "end": "2026-11-02T11:00:00.000Z" }
    ]
  }
}
```

For a seated event type that shows availability counts, each slot also has `attendeesCount` (seats
taken) and, when the time already has a booking, its `bookingUid`:

```json
{ "start": "2026-11-02T09:00:00.000Z", "attendeesCount": 1, "bookingUid": "cmvux1abc0000xyz" }
```

## Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `eventTypeId - Provide eventTypeId, or eventTypeSlug and username` | No event type given |
| 400 | `start - Invalid input` | A `start` or `end` in another format |
| 400 | `Ask for slots from a start before the end, at most 62 days apart.` | `start` isn't before `end`, or the range is over 62 days |
| 400 | `Please choose a valid time zone` | Unknown `timeZone` |
| 400 | `This event can't be booked for that length of time` | `duration` isn't offered |
| 404 | `Event type not found` | Unknown event type id or slug |
| 404 | `User not found` | Unknown `username` |
