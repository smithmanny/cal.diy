# Authentication API Reference

Authentication, versioning, errors and pagination for a Cal.diy instance's API v2
(`https://<your-cal-diy-host>/api/v2`).

## Authentication Methods

1. **API key** - full access to the key owner's account
2. **OAuth access token** - issued by the instance's OAuth provider to a third-party app; read only

Some endpoints also work without credentials (public slots, booking, cancelling by uid). When a
credential is sent anyway, it must be valid.

Cal.com's platform authentication (`x-cal-client-id` / `x-cal-secret-key`, managed users) is not
served by Cal.diy.

## API Key Authentication

### Obtaining an API Key

1. Sign in to the Cal.diy instance
2. Go to Settings > Developer > API keys
3. Create a key, choosing when it expires (never, or 7, 30, 90 or 365 days)
4. Copy it: it is shown only once

### Using API Keys

```http
GET /api/v2/bookings
Authorization: Bearer cal_abc123...
cal-api-version: 2024-08-13
```

All keys start with `cal_`. Keys from an existing Cal install that was imported keep working.

### Example Request

```bash
curl "https://cal.example.com/api/v2/me" \
  -H "Authorization: Bearer cal_abc123"
```

Keys are managed only in the app's settings; there is no API endpoint to create or refresh them.

## OAuth Access Tokens

An instance admin registers the app as an OAuth client (Settings > Admin > OAuth). The app sends the
user to `/auth/oauth2/authorize` (`client_id`, `redirect_uri`, `state`, `scope`, and PKCE
`code_challenge` with `S256`, required for public clients), then exchanges the code at
`POST /api/auth/oauth/token` (`grant_type=authorization_code`, and later
`grant_type=refresh_token`). Access tokens last 30 minutes, refresh tokens 30 days.

```http
GET /api/v2/bookings
Authorization: Bearer <access token>
cal-api-version: 2024-08-13
```

Tokens only allow `GET` requests: `READ_BOOKING` for `/api/v2/bookings*`, `READ_PROFILE` for every
other endpoint. Writes with a token answer `403`.

## API Versioning

Versioned endpoints require the `cal-api-version` header with the exact version they serve, and answer
`400` otherwise:

| Endpoints | `cal-api-version` |
| --- | --- |
| `/bookings*` | `2024-08-13` |
| `/event-types*` | `2024-06-14` |
| `/schedules*` | `2024-06-11` |
| `/slots` | `2024-09-04` |
| `/me`, `/webhooks*` | none |

```bash
curl -X POST "https://cal.example.com/api/v2/bookings" \
  -H "Content-Type: application/json" \
  -H "cal-api-version: 2024-08-13" \
  -d '{"start":"2024-01-15T10:00:00Z","eventTypeId":123,"attendee":{"name":"Ada","email":"ada@example.com","timeZone":"Europe/London"}}'
```

## Rate Limiting

Each API key may make 120 requests a minute. Over the limit, the API answers `429` with
`error.code` `ThrottlerException`. Back off and retry; no rate-limit headers are sent.

## Testing Authentication

```bash
curl "https://cal.example.com/api/v2/me" -H "Authorization: Bearer cal_abc123"
```

```json
{
  "status": "success",
  "data": {
    "id": 123,
    "email": "user@example.com",
    "username": "johndoe",
    "timeZone": "America/New_York"
  }
}
```

## Common Authentication Patterns

### Server-Side Integration

```typescript
async function getBookings() {
  const response = await fetch(`${process.env.CAL_API_URL}/bookings`, {
    headers: {
      Authorization: `Bearer ${process.env.CAL_API_KEY}`,
      "cal-api-version": "2024-08-13",
    },
  });
  if (!response.ok) throw new Error(`Cal.diy API error: ${response.status}`);
  return response.json();
}
```

## Security Best Practices

1. Keep keys in environment variables, never in code or version control
2. Use a separate key per integration, with an expiry, so one can be revoked alone
3. Delete keys you no longer use (Settings > Developer > API keys)
4. Use HTTPS
5. Never log full keys

## Error Handling

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request: invalid input, or a missing or wrong `cal-api-version` |
| 401 | Missing, invalid or expired credentials |
| 403 | Not allowed (e.g. a write with an OAuth token) |
| 404 | Not found, or not yours |
| 409 | Conflict (e.g. the slot was just taken) |
| 429 | Rate limited |
| 500 | Internal server error |

### Error Response Format

```json
{
  "status": "error",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "path": "/api/v2/bookings",
  "error": {
    "code": "BadRequestException",
    "message": "attendee.email - Invalid email"
  }
}
```

`error.code` is the exception name for the status: `BadRequestException`, `UnauthorizedException`,
`ForbiddenException`, `NotFoundException`, `ConflictException`, `ThrottlerException`,
`InternalServerErrorException`. `message` is English text; invalid input lists `path - message` for
each problem.

## Pagination

`GET /bookings` takes `take` (1-250, default 100) and `skip` (default 0):

```http
GET /api/v2/bookings?take=20&skip=40
```

```json
{
  "status": "success",
  "data": [],
  "pagination": {
    "totalItems": 150,
    "remainingItems": 90,
    "returnedItems": 20,
    "itemsPerPage": 20,
    "currentPage": 3,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

## Troubleshooting

### 401 Unauthorized

1. The header is exactly `Authorization: Bearer <key>`, with one space
2. The key starts with `cal_`, has no extra whitespace, and hasn't expired or been deleted
3. You are calling the instance that issued the key

### 400 about `cal-api-version`

Send the version from the table above for that endpoint.

### 403 Forbidden with an OAuth token

OAuth tokens are read only; use an API key for writes.
