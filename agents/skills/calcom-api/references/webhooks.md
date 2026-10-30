# Webhooks

Webhooks send an HTTP `POST` to your URL when something happens to a booking you host. The
endpoints need an API key (`GET` also accepts an OAuth token with `READ_PROFILE`) and no version
header. You only see your own webhooks; anyone else's answer 404.

## Triggers

| Trigger | Sent when |
| --- | --- |
| `BOOKING_CREATED` | A booking is made and doesn't need confirmation, or the host confirms a pending one. For a recurring booking, once per occurrence |
| `BOOKING_REQUESTED` | A booking is made that needs the host's confirmation |
| `BOOKING_RESCHEDULED` | A booking (or a seat) is moved to a new time |
| `BOOKING_CANCELLED` | A booking is cancelled, a seat is given up, or the host asks the attendees to pick a new time |
| `BOOKING_REJECTED` | The host declines a pending booking |
| `BOOKING_NO_SHOW_UPDATED` | The host marks attendees absent or present |

These are the only values `triggers` accepts. Other Cal.com triggers (`MEETING_ENDED`,
`FORM_SUBMITTED`, `RECORDING_READY`, ...) are rejected with 400.

## The webhook object

```json
{
  "id": "060a558f-fa98-4722-91a4-005d641930f0",
  "userId": 1,
  "subscriberUrl": "https://example.com/cal-hook",
  "triggers": ["BOOKING_CREATED", "BOOKING_CANCELLED"],
  "active": true,
  "payloadTemplate": null
}
```

The secret is never returned.

## Input fields

| Field | Type | Constraints |
| --- | --- | --- |
| `subscriberUrl` | string | Trimmed `http://` or `https://` URL, up to 2000 characters. Unique among your webhooks |
| `triggers` | string[] | At least one trigger from the table above |
| `active` | boolean | Inactive webhooks receive nothing |
| `payloadTemplate` | string or null | Up to 10000 characters. See [Custom payloads](#custom-payloads); `null` or `""` sends the default payload |
| `secret` | string | Up to 500 characters. Signs deliveries. On update, leave it out to keep the current one, or send `""` to remove it |

Unknown fields are rejected.

---

## List webhooks

`GET /webhooks` — all your webhooks, not paginated.

```bash
curl http://localhost:3000/api/v2/webhooks \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066"
```

```json
{ "status": "success", "data": [ { "id": "060a558f-fa98-4722-91a4-005d641930f0", "...": "..." } ] }
```

## Create a webhook

`POST /webhooks` — answers **201** with the webhook. `subscriberUrl`, `triggers` and `active` are
required.

```bash
curl -X POST http://localhost:3000/api/v2/webhooks \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriberUrl": "https://example.com/cal-hook",
    "triggers": ["BOOKING_CREATED", "BOOKING_CANCELLED"],
    "active": true,
    "secret": "whsec_test"
  }'
```

## Get a webhook

`GET /webhooks/{webhookId}` — `webhookId` is the uuid from `id`.

## Update a webhook

`PATCH /webhooks/{webhookId}` — every field optional; others keep their value. Returns the updated
webhook.

```bash
curl -X PATCH http://localhost:3000/api/v2/webhooks/060a558f-fa98-4722-91a4-005d641930f0 \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "Content-Type: application/json" \
  -d '{"active":false}'
```

## Delete a webhook

`DELETE /webhooks/{webhookId}` — returns the deleted webhook.

## Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `active - Required` | Missing required field on create |
| 400 | `triggers.0 - Invalid enum value. Expected 'BOOKING_CREATED' \| ... , received 'MEETING_ENDED'` | Unsupported trigger |
| 400 | `subscriberUrl - Invalid url` / `subscriberUrl - Invalid input` | Not a URL / not `http(s)` |
| 400 | `body - Unrecognized key(s) in object: '<field>'` | Unknown field |
| 404 | `Not found` | Unknown id, not a uuid, or not yours |
| 409 | `Webhook subscriber url is already defined` | You already have a webhook for that URL |

---

## Deliveries

Each delivery is a `POST` with these headers:

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` (or `application/x-www-form-urlencoded` for a non-JSON template) |
| `X-Cal-Signature-256` | Hex HMAC-SHA256 of the raw body, keyed with the webhook's secret. `no-secret-provided` when the webhook has no secret |
| `X-Cal-Webhook-Version` | `2021-10-20` |

Deliveries time out after 10 seconds, don't follow redirects and are not retried. Answer with a
2xx quickly.

### Default body

```json
{
  "triggerEvent": "BOOKING_CANCELLED",
  "createdAt": "2026-10-30T11:54:00.512Z",
  "payload": { }
}
```

For every trigger except `BOOKING_NO_SHOW_UPDATED`, `payload` describes the booking:

```json
{
  "type": "intro",
  "title": "Intro call between Ada Host and Bob Booker",
  "description": "Looking forward",
  "additionalNotes": "Looking forward",
  "customInputs": {},
  "startTime": "2026-11-02T10:00:00.000Z",
  "endTime": "2026-11-02T10:30:00.000Z",
  "organizer": {
    "id": 1,
    "name": "Ada Host",
    "email": "ada@example.com",
    "username": "ada",
    "timeZone": "Europe/London",
    "language": { "locale": "en" },
    "utcOffset": 0
  },
  "responses": {
    "name": { "label": "your_name", "value": "Bob Booker", "isHidden": false },
    "email": { "label": "email_address", "value": "bob@example.com", "isHidden": false },
    "location": { "label": "location", "value": { "value": "link", "optionValue": "" }, "isHidden": false },
    "notes": { "label": "additional_notes", "value": "Looking forward", "isHidden": false },
    "guests": { "label": "additional_guests", "value": ["carol@example.com"], "isHidden": false }
  },
  "userFieldsResponses": {},
  "attendees": [
    {
      "name": "Bob Booker",
      "email": "bob@example.com",
      "timeZone": "America/New_York",
      "phoneNumber": null,
      "language": { "locale": "en" },
      "utcOffset": -300
    }
  ],
  "location": "https://example.com/room",
  "uid": "cmvuwy62t00025m2s5a3z2m6j",
  "eventTitle": "Intro call",
  "eventDescription": null,
  "requiresConfirmation": false,
  "price": 0,
  "currency": "usd",
  "length": 30,
  "status": "CANCELLED",
  "cancellationReason": "Can no longer make it",
  "metadata": {}
}
```

| Field | Notes |
| --- | --- |
| `type` | The event type's slug, or null |
| `description` | The booking's description, else the attendee's notes |
| `startTime`, `endTime` | ISO 8601, UTC |
| `organizer.utcOffset`, `attendees[].utcOffset` | Minutes from UTC at the start time |
| `responses` | Every booking question, keyed by field slug: `label`, `value` (absent if unanswered), `isHidden` |
| `userFieldsResponses` | The same, for custom (non built-in) questions only |
| `requiresConfirmation` | `true` while the booking is pending |
| `status` | Upper case: `ACCEPTED`, `PENDING`, `CANCELLED`, `REJECTED`, `AWAITING_HOST` |
| `cancellationReason` | null unless cancelled with a reason |

Extra fields:

- Seat changes add `attendeeSeatId`, the seat's uid.
- `BOOKING_RESCHEDULED` adds `rescheduleUid`, `rescheduleStartTime` and `rescheduleEndTime` (the old
  booking's uid and times). `uid` is the new booking's.

`BOOKING_NO_SHOW_UPDATED` sends only the change:

```json
{
  "triggerEvent": "BOOKING_NO_SHOW_UPDATED",
  "createdAt": "2026-11-02T11:00:00.000Z",
  "payload": {
    "message": "bob@example.com marked as no-show",
    "attendees": [{ "email": "bob@example.com", "noShow": true }],
    "bookingUid": "cmvuwy62t00025m2s5a3z2m6j",
    "bookingId": 2
  }
}
```

`message` is in the organizer's language: `"<email> marked as no-show"`, `"<email> unmarked as no-show"`,
or `"No-show status updated for attendees"` when several attendees changed.

### Custom payloads

With `payloadTemplate` set, the body is the template with `{{path}}` placeholders replaced by
values from the booking payload, plus `triggerEvent` and `createdAt`. Dotted paths reach into
objects (`{{organizer.name}}`). Missing values become empty; objects are inserted as JSON. Only
plain placeholders work, not Handlebars blocks or helpers.

If the template (with placeholders emptied) is valid JSON, values are escaped as JSON string
content and the body is sent as `application/json`. Otherwise it's sent as
`application/x-www-form-urlencoded`, unescaped.

```json
{"event":"{{triggerEvent}}","uid":"{{uid}}","who":"{{organizer.name}}"}
```

delivers

```json
{"event":"BOOKING_RESCHEDULED","uid":"cmvuwzpgq00055t23604u2u2j","who":"Ada Host"}
```

The signature is computed over the rendered body.

### Verifying the signature

Compute the HMAC over the exact bytes you received, before parsing them.

Node.js:

```js
import crypto from "node:crypto";
import express from "express";

const app = express();

app.post("/cal-hook", express.raw({ type: "*/*" }), (req, res) => {
  const expected = crypto
    .createHmac("sha256", process.env.CAL_WEBHOOK_SECRET)
    .update(req.body)
    .digest("hex");
  const received = req.get("X-Cal-Signature-256") ?? "";
  const valid =
    received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!valid) return res.status(401).end();

  const { triggerEvent, payload } = JSON.parse(req.body.toString("utf8"));
  // handle triggerEvent ...
  res.status(200).end();
});
```

Python:

```python
import hashlib
import hmac

def is_valid(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```
