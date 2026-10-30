---
title: Error Handling Patterns
impact: HIGH
impactDescription: Proper error handling ensures debuggable, translated and secure errors
tags: errors, apperror, server-functions, services, i18n
---

# Error Handling Patterns

**Impact: HIGH**

## AppError for expected failures

Throw `AppError(code, status, values)` from `apps/web/src/server/errors.ts` for every failure a user
can cause (not found, not allowed, conflict, invalid input). `code` is a translation key from
`packages/i18n/locales/en/common.json`; the client shows it with `t()`. `status` is one of
400, 401, 403, 404, 409, 429 (default 400). `values` travel with the code to the client: placeholders for the translation, or
extra data such as the form `field` the error belongs to.

```typescript
import { AppError } from "../errors";

// Good - translation key, status, and values for the message
if (!found || found.userId !== hostId) throw new AppError("booking_not_found", 404);
if (await this.repo.findByUserIdAndUrl(userId, input.subscriberUrl))
  throw new AppError("webhook_subscriber_url_reserved", 409);
throw new AppError("invalid_verification_code", 400, { field: "verificationCode" });

// Bad - English text the client can't translate, and no status
throw new Error("Booking not found");
```

Services, server functions and API v2 routes all throw the same `AppError`; there is no separate
error type per transport.

## What happens to other errors

- **Server functions**: `errorMiddleware` (`apps/web/src/server/errorMiddleware.ts`, registered in `src/start.ts`) logs any error that isn't an `AppError` (or a redirect / not-found) and replaces it with `something_went_wrong`, so SQL and stack traces never reach the browser
- **API v2**: `respond()` in `apps/web/src/server/api-v2/http.ts` turns an `AppError` into Cal's error shape with its status and the English message, `ApiInputError` into a 400, and anything else into a logged 500

So an unexpected `Error` is fine for bugs and invariants (it is logged), but never for something a
user should see.

## Translating third-party errors

Map library errors to AppErrors at the boundary. `withTeamErrors` (`apps/web/src/server/teams/errors.ts`)
wraps Better Auth's organization calls:

```typescript
export async function withTeamErrors<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    const code = typeof error.body?.code === "string" ? error.body.code : "";
    if (TEAM_ERROR_KEYS[code]) throw new AppError(TEAM_ERROR_KEYS[code], 409);
    if (error.statusCode === 403 || error.statusCode === 401) throw new AppError("unauthorized", 403);
    throw error;
  }
}
```

Better Auth's own error codes for sign-in and sign-up are mapped in `apps/web/src/lib/auth-errors.ts`.

## On the client

Server functions reject with the AppError's message (`code`, or `code:{json}` with values). Read it
with the helpers in `apps/web/src/lib/errors.ts`, as `components/teams/useTeamAction.ts` does:

```tsx
import { errorMessageKey } from "~/lib/errors";

try {
  await action();
} catch (error) {
  setErrorKey(errorMessageKey(error)); // rendered with t(errorKey); errorMessageValues(error) for placeholders
}
```

Every key a page can show, including error codes, must be in the `MESSAGE_KEYS` its route loads,
since routes load only the translations they list (e.g. `team_url_taken` in
`components/teams/messages.ts`, `AUTH_ERROR_MESSAGE_KEYS` on the auth pages).

## Messages for developers

Errors that are not shown to users (logs, invariants) should carry context:

```typescript
// Good
throw new Error(`No booking ${uid}`);
console.error(`Booking listener failed for ${event.type}`, error);

// Bad
throw new Error("failed");
```
