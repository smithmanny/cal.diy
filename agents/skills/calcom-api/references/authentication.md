# Authentication and `/me`

All requests go to `<your Cal.diy URL>/api/v2`, e.g. `http://localhost:3000/api/v2`.

## The Authorization header

```
Authorization: Bearer <API key or OAuth access token>
```

How the header is read:

- No `Authorization` header: the request is anonymous. Public endpoints run without a user; all
  others answer 401.
- Anything other than `Bearer <token>` (case-insensitive `Bearer`, one token, no spaces): 401.
- A token shaped like a JWT (`xxx.yyy.zzz`) is checked as an OAuth access token.
- Anything else is checked as an API key.

A credential that is wrong or expired is always rejected with 401, even on public endpoints. It is
never treated as anonymous.

## API keys

- Format: `cal_` followed by 32 lowercase hex characters, e.g. `cal_5ffe1dc373bcc67c5780edb0cc510066`.
  The `cal_` prefix is optional when sending the key.
- Create one in the app under **Settings > Developer > API keys** (`/settings/developer/api-keys`).
  Give it a name and an expiry: never, 7, 30, 90 or 365 days. The full key is shown once; the list
  afterwards shows only its first characters. Delete keys from the same page. There is no API
  endpoint for creating, refreshing or deleting keys.
- A key acts as the user who created it, with read and write access to everything that user owns.
- Rate limit: 120 requests per key per minute. Over the limit you get:

```json
{
  "status": "error",
  "timestamp": "2026-10-30T11:52:07.790Z",
  "path": "/api/v2/bookings",
  "error": { "code": "ThrottlerException", "message": "Rate limit exceeded" }
}
```

Requests without a key and OAuth requests are not limited by this.

```bash
curl http://localhost:3000/api/v2/me \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066"
```

## OAuth access tokens

The instance is an OAuth 2.0 provider (authorization code grant, with PKCE). Tokens are read-only.

### Registering a client

An instance admin registers clients under **Settings > Admin > OAuth** (`/settings/admin/oauth`)
with a name, redirect URI, optional logo and a type:

- **Confidential**: gets a client secret (shown once) and must send it to the token endpoint.
- **Public**: no secret; must use PKCE (`S256`).

Clients are approved when created.

### Scopes

| Scope | Allows |
| --- | --- |
| `READ_BOOKING` | `GET /bookings` and `GET /bookings/{bookingUid}` |
| `READ_PROFILE` | `GET` on `/me`, `/event-types...`, `/schedules...` and `/slots` |

No scope reads webhooks: their URLs and templates are your own configuration, so `/webhooks` needs
an API key (an OAuth token gets 403).

Any non-GET request with an OAuth token, including the public `POST /bookings`, answers 403. A GET
without the needed scope also answers 403:

```json
{
  "status": "error",
  "timestamp": "2026-10-30T11:55:05.151Z",
  "path": "/api/v2/bookings",
  "error": { "code": "ForbiddenException", "message": "Unauthorized" }
}
```

### Flow

1. Send the user to the consent page:

```
<your Cal.diy URL>/auth/oauth2/authorize?client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&scope=READ_BOOKING%20READ_PROFILE&state=STATE&code_challenge=CHALLENGE&code_challenge_method=S256
```

`scope` is space- or comma-separated. `state` and the PKCE parameters are optional for confidential
clients. `redirect_uri` must equal the registered one. After consent the user is sent to
`REDIRECT_URI?code=...&state=...`. Codes are valid for 10 minutes and work once.

2. Exchange the code (form-encoded or JSON; client credentials may also go in HTTP Basic auth):

```bash
curl -X POST http://localhost:3000/api/auth/oauth/token \
  -d grant_type=authorization_code \
  -d client_id=CLIENT_ID \
  -d client_secret=CLIENT_SECRET \
  -d code=CODE \
  -d redirect_uri=REDIRECT_URI \
  -d code_verifier=VERIFIER
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 1800
}
```

Access tokens last 30 minutes, refresh tokens 30 days.

3. Refresh with `grant_type=refresh_token`, `client_id`, `client_secret` (confidential clients) and
   `refresh_token`, either at `/api/auth/oauth/token` or at `/api/auth/oauth/refreshToken`. Both
   return a new token pair.

Token endpoint errors use the OAuth shape, e.g. `{"error":"invalid_grant","error_description":"code_invalid_or_expired"}`
(400), `invalid_client` (401) or `unsupported_grant_type` (400).

`GET` or `POST /api/auth/oauth/me` with a `READ_PROFILE` token returns `{"username":"ada"}` (status 201).

Tokens are signed with the instance's `CALENDSO_ENCRYPTION_KEY`, so they stop working if that key
changes.

---

## GET /me

The profile of the key's owner. No version header.

**Auth:** API key, or OAuth with `READ_PROFILE`.

```bash
curl http://localhost:3000/api/v2/me \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066"
```

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "username": "ada",
    "email": "ada@example.com",
    "name": "Ada Host",
    "avatarUrl": null,
    "bio": null,
    "timeFormat": 12,
    "defaultScheduleId": 1,
    "weekStart": "Sunday",
    "timeZone": "Europe/London",
    "locale": "en",
    "organizationId": null
  }
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | |
| `username` | string | `""` if the user has none |
| `email` | string | |
| `name` | string or null | |
| `avatarUrl` | string or null | |
| `bio` | string or null | |
| `timeFormat` | `12` or `24` | |
| `defaultScheduleId` | number or null | |
| `weekStart` | string | A weekday name, e.g. `"Monday"` |
| `timeZone` | string | IANA name |
| `locale` | string | Defaults to `"en"` |
| `organizationId` | number or null | |

## PATCH /me

Update the profile. Every field is optional; unknown fields (including `email`) are rejected.
Returns the updated profile in the same shape as `GET /me`.

**Auth:** API key only.

| Field | Type | Constraints |
| --- | --- | --- |
| `name` | string | Trimmed, 1-200 characters |
| `bio` | string or null | Up to 5000 characters |
| `avatarUrl` | string or null | A URL, up to 2000 characters |
| `timeFormat` | number | `12` or `24` |
| `defaultScheduleId` | number | Positive integer; must be one of your schedules |
| `weekStart` | string | `Sunday`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday` or `Saturday` |
| `timeZone` | string | 1-100 characters; must be a valid IANA time zone |
| `locale` | string | 2-20 characters; matched case-insensitively to a supported locale, falling back to the language part (`fr-CA` becomes `fr`) |

Email changes need the verification flow in the app's settings and can't be made here.

```bash
curl -X PATCH http://localhost:3000/api/v2/me \
  -H "Authorization: Bearer cal_5ffe1dc373bcc67c5780edb0cc510066" \
  -H "Content-Type: application/json" \
  -d '{"timeZone":"Europe/Rome","timeFormat":24}'
```

Errors:

| Status | Message | When |
| --- | --- | --- |
| 400 | `body - Unrecognized key(s) in object: 'email'` | A field not listed above |
| 400 | `Please choose a valid time zone` | Unknown `timeZone` |
| 400 | `This language isn't supported.` | `locale` doesn't match a supported language |
| 404 | `Not found` | `defaultScheduleId` isn't one of your schedules |
