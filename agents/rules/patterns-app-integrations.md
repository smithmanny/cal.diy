---
paths:
  - "apps/web/src/lib/apps.ts"
  - "apps/web/src/server/apps/**"
  - "apps/web/src/server/calendars/**"
  - "apps/web/src/server/video/**"
  - "apps/web/src/server/payments/**"
title: App Integration Patterns
impact: MEDIUM
impactDescription: Integrations must stay compatible with Cal's stored data and testable against fakes
tags: apps, integrations, calendars, video, payments, oauth
---

# App Integration Patterns

**Impact: MEDIUM**

Apps (calendars, video, payments) are ordinary code in `apps/web`. There is no app-store package,
no generated files and no CLI.

## Where things live

| What | Where |
| --- | --- |
| App catalog (slug, Cal's folder name, credential type, location type, install flow) | `apps/web/src/lib/apps.ts` (browser-safe, no secrets) |
| Logos | `apps/web/public/app-store/<slug>/` |
| Credentials (read, create, encrypted keys) | `apps/web/src/server/apps/CredentialRepository.ts`, `CredentialVault.ts` |
| OAuth install flow per app | `apps/web/src/server/apps/oauthApps.ts`, routes `apps/web/src/routes/api/integrations/$app/add.ts` and `callback.ts` |
| Calendar providers | `apps/web/src/server/calendars/<provider>/` implementing `CalendarProvider` / `CalendarClient` |
| Video providers | `apps/web/src/server/video/providers.ts` implementing `VideoProvider` / `VideoClient` |
| Stripe | `apps/web/src/server/payments/stripe/` |
| Which providers are enabled | each domain's `container.ts` (from env settings) |

## Stay compatible with Cal's data

Credentials, event type locations and booking references imported from Cal must keep working.
Keep Cal's slugs, folder names (`dirName`, which also names the OAuth callback route), credential
types (`google_calendar`, `office365_calendar`, ...) and location types
(`integrations:google:meet`, ...). Keys are encrypted with `CALENDSO_ENCRYPTION_KEY` in Cal's format.

## Adding an app

1. Add its row to `APPS` in `apps/web/src/lib/apps.ts`
2. Add the logo under `apps/web/public/app-store/<slug>/`
3. Implement the provider interface for its kind (calendar, video) in that domain's folder
4. Register it in the domain's `container.ts`, only when its settings are present
5. For OAuth apps, add it to `oauthApps.ts`; settings go in `apps/web/.env.example` and `.dev.vars.example`
6. Make every third-party URL overridable through `appEndpoints()` (`apps/web/src/server/apps/endpoints.ts`), which only honors overrides outside production builds
7. Add a fake (like `apps/web/src/server/apps/fakeApps.ts` or `calendars/google/fakeGoogle.ts`), use it in unit tests through `fetchImpl`, and serve it in e2e from `apps/web/e2e/support/`
8. Add translations for the app's UI strings

**Incorrect:**

```typescript
// Hard-coded endpoint: can't be tested against a fake
const response = await fetch("https://api.zoom.us/v2/users/me/meetings", { method: "POST", ... });
```

**Correct:**

```typescript
// The client gets its base URL from appEndpoints(), so e2e points it at the fake server
const created = await this.session.request(`${this.apiUrl}/users/me/meetings`, { method: "POST", body });
```

## Secrets

Credential keys never leave the server. `CredentialRepository` is the only reader of
`credential.key` / `encryptedKey`, and services return app state to the UI, never the key.
