# Schedules

Every schedules endpoint needs the header `cal-api-version: 2024-06-11` and an API key (`GET`
requests also accept an OAuth token with `READ_PROFILE`). You only see and change your own
schedules; anyone else's answer 404.

A schedule is a set of weekly hours plus date overrides, in one time zone. Each user has one
default schedule, which event types without a `scheduleId` use.

## The schedule object

```json
{
  "id": 2,
  "ownerId": 1,
  "name": "Evenings",
  "timeZone": "America/New_York",
  "availability": [
    { "days": ["Monday", "Wednesday"], "startTime": "18:00", "endTime": "21:00" }
  ],
  "isDefault": false,
  "overrides": [
    { "date": "2030-01-07", "startTime": "00:00", "endTime": "00:00" },
    { "date": "2030-01-08", "startTime": "10:00", "endTime": "12:00" }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | |
| `ownerId` | number | Your user id |
| `name` | string | |
| `timeZone` | string | IANA name |
| `availability` | array | Weekly hours. Days with the same hours are grouped into one entry |
| `availability[].days` | string[] | `Sunday` ... `Saturday` |
| `availability[].startTime`, `endTime` | string | `HH:mm`, 24-hour |
| `isDefault` | boolean | |
| `overrides` | array | One entry per range on a date. `00:00`-`00:00` means unavailable all day |

## Input fields

| Field | Type | Constraints |
| --- | --- | --- |
| `name` | string | Trimmed, 1-100 characters |
| `timeZone` | string | 1-100 characters |
| `isDefault` | boolean | `true` makes this the default schedule |
| `availability` | array | Up to 50 entries of `{ days, startTime, endTime }`; `days` has at least one weekday name; times are `HH:mm` (`00:00`-`23:59`) |
| `overrides` | array | Up to 500 entries of `{ date, startTime, endTime }`; `date` is `YYYY-MM-DD`. Use `00:00`-`00:00` for a day off; several entries on the same date add ranges |

Sending `availability` or `overrides` replaces the whole list.

---

## List schedules

`GET /schedules`

```bash
curl http://localhost:3000/api/v2/schedules \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-11"
```

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "ownerId": 1,
      "name": "Working hours",
      "timeZone": "Europe/London",
      "availability": [
        { "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "startTime": "09:00", "endTime": "17:00" }
      ],
      "isDefault": true,
      "overrides": []
    }
  ]
}
```

## Get the default schedule

`GET /schedules/default` — returns your default schedule, or `"data": null` if you have none.

## Get a schedule

`GET /schedules/{scheduleId}`

Errors: 400 `scheduleId must be a positive integer.`; 404 `Not found`.

## Create a schedule

`POST /schedules` — answers **201**. `name`, `timeZone` and `isDefault` are required;
`availability` defaults to Monday to Friday, 09:00-17:00, and `overrides` to none. Your first
schedule becomes the default whatever `isDefault` says.

```bash
curl -X POST http://localhost:3000/api/v2/schedules \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-11" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Evenings",
    "timeZone": "America/New_York",
    "isDefault": false,
    "availability": [{ "days": ["Monday", "Wednesday"], "startTime": "18:00", "endTime": "21:00" }],
    "overrides": [
      { "date": "2030-01-07", "startTime": "00:00", "endTime": "00:00" },
      { "date": "2030-01-08", "startTime": "10:00", "endTime": "12:00" }
    ]
  }'
```

The response is the schedule object shown at the top.

## Update a schedule

`PATCH /schedules/{scheduleId}` — every field optional; others keep their value. Returns the
updated schedule. `isDefault: true` makes it the default; `isDefault: false` is ignored (make
another schedule the default instead).

```bash
curl -X PATCH http://localhost:3000/api/v2/schedules/2 \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-11" \
  -H "Content-Type: application/json" \
  -d '{"name":"Evenings v2","isDefault":true}'
```

## Delete a schedule

`DELETE /schedules/{scheduleId}` — returns `{"status":"success","data":null}`.

```bash
curl -X DELETE http://localhost:3000/api/v2/schedules/2 \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "cal-api-version: 2024-06-11"
```

## Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `timeZone - Required, isDefault - Required` | Missing required fields on create |
| 400 | `availability.0.startTime - must be HH:mm` | Bad time format |
| 400 | `overrides.0.date - must be YYYY-MM-DD` | Bad date format |
| 400 | `Invalid time on Monday` | A weekly range that ends before it starts |
| 400 | `Time ranges can't overlap` / `End time cannot be before start time` | Overlapping ranges, or a bad override range |
| 400 | `Please choose a valid time zone` | Unknown time zone |
| 404 | `Not found` | Unknown schedule, or not yours |
| 409 | `You can't delete your default schedule. Make another schedule the default first.` | Deleting the default |
