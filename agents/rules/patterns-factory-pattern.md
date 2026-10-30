---
title: Push Conditionals to Entry Points with Factories
impact: HIGH
impactDescription: Keeps services focused and prevents complexity accumulation
tags: patterns, factory, conditionals, single-responsibility, polymorphism
---

## Push Conditionals to Entry Points with Factories

**Impact: HIGH**

If statements that pick an implementation belong at the entry point (the container or a factory),
not scattered through services. A service written for one purpose slowly fills with
`if (type === ...)` branches until nobody can follow it.

**Incorrect (provider checks inside the service):**

```typescript
class CalendarService {
  async busyTimes(credential: CredentialRow, from: Date, to: Date) {
    if (credential.type === "google_calendar") {
      // Google-specific requests...
    } else if (credential.type === "office365_calendar") {
      // Microsoft Graph requests...
    } else if (credential.type === "caldav_calendar") {
      // CalDAV REPORT requests...
    }
  }
}
```

**Correct (one interface, one implementation per provider, chosen at the edge):**

```typescript
// apps/web/src/server/calendars/types.ts
export interface CalendarClient {
  listCalendars(): Promise<CalendarListEntry[]>;
  busyTimes(calendarIds: string[], from: Date, to: Date): Promise<BusyInterval[]>;
  createEvent(calendarId: string, event: CalendarEventInput): Promise<CreatedCalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

export type CalendarProvider = {
  type: string; // Credential.type
  open(key: unknown, onKeyChange: (key: unknown) => Promise<void>): CalendarClient;
  exchangeCode?(code: string): Promise<unknown>;
  revoke?(key: unknown): Promise<void>;
};

// apps/web/src/server/calendars/google/provider.ts
export function googleCalendarProvider(config: GoogleOAuthConfig, fetchImpl: typeof fetch = fetch): CalendarProvider {
  return {
    type: GOOGLE_CALENDAR_TYPE,
    open: (key, onKeyChange) => new GoogleCalendarClient(key as GoogleTokens, config, onKeyChange, fetchImpl),
    exchangeCode: (code) => exchangeCode(config, code, fetchImpl),
  };
}

// apps/web/src/server/calendars/container.ts - the only place that decides which providers exist
function calendarProviders(): CalendarProvider[] {
  const google = googleOAuthConfig();
  const outlook = outlookCalendarOAuth(OFFICE365_CALENDAR_SCOPES);
  const endpoints = appEndpoints();
  return [
    ...(google ? [googleCalendarProvider(google)] : []),
    ...(outlook ? [outlookCalendarProvider(outlook, endpoints.microsoftGraph)] : []),
    calDavProvider(),
    appleCalendarProvider(endpoints.appleCalDav),
  ];
}
```

`CalendarService` looks the provider up by `credential.type` and only ever talks to a
`CalendarClient`. Video apps follow the same shape (`VideoProvider` / `VideoClient` in
`apps/web/src/server/video/`), and booking side effects are a list of `BookingListener`s assembled
in `bookings/integrations.ts`.

**Benefits:**
- Adding a provider means a new folder and one line in the container, not edits across the service
- Each implementation is tested on its own (against fakes like `calendars/google/fakeGoogle.ts`)
- The service keeps one responsibility

**Guidelines:**
- Decide "which implementation" in `container.ts` or a factory function, not in service methods
- Prefer an interface with several implementations over `switch (type)` in business code
- Watch for if statements piling up in a service during review

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
